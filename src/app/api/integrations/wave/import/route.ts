import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  db,
  accounts,
  transactions,
  journalLines,
  categories,
  taxes,
  transactionTaxes,
} from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

// Accepts the parsed Wave preview from the client. Account type inferences
// can be overridden in the UI before commit. Transaction groups are pairs of
// {debits[], credits[]} that already balance (parser guarantees this); we
// translate each group into one transactions row + N journal_lines rows.

const AccountIn = z.object({
  name: z.string().min(1),
  type: z.enum(["asset", "liability", "equity", "income", "expense"]),
})

const LineIn = z.object({
  account: z.string().min(1),
  amount: z.number().nonnegative(),
})

const GroupIn = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string(),
  amount: z.number().positive(),
  debits: z.array(LineIn).min(1),
  credits: z.array(LineIn).min(1),
})

const CategoryIn = z.object({
  name: z.string().min(1),
  kind: z.enum(["income", "expense"]),
})

const Input = z.object({
  accounts: z.array(AccountIn).min(1),
  groups: z.array(GroupIn).default([]),
  categories: z.array(CategoryIn).default([]),
  reference: z.string().optional(),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())

  // Step 1: upsert accounts by name. We don't blow away existing accounts —
  // just create the missing ones. Build name → id and name → type maps so
  // journal lines can resolve their account targets and we can classify
  // each group as deposit / withdrawal / journal_entry.
  const existing = await db.select().from(accounts)
  const byName = new Map<string, number>()
  const typeByName = new Map<string, string>()
  for (const a of existing) {
    const key = a.name.trim().toLowerCase()
    byName.set(key, a.id)
    typeByName.set(key, a.accountType)
  }

  const accountsCreated: Array<{ id: number; name: string }> = []
  for (const a of body.accounts) {
    const key = a.name.trim().toLowerCase()
    if (byName.has(key)) {
      // Make sure the type map covers this name even when the row already
      // existed pre-import (so classification still works for re-imports).
      if (!typeByName.has(key)) typeByName.set(key, a.type)
      continue
    }
    const [created] = await db
      .insert(accounts)
      .values({
        name: a.name.trim(),
        accountType: a.type,
      })
      .returning({ id: accounts.id, name: accounts.name })
    byName.set(key, created.id)
    typeByName.set(key, a.type)
    accountsCreated.push(created)
  }

  // Look up active taxes once. Wave's compound entries land tax (e.g.
  // GST) on its own line under a tax account; we collapse those at
  // import time into transaction_taxes metadata + a category bump so
  // the simple form's mental model holds (deposit = principal asset
  // ↔ category at gross, with tax tracked as metadata).
  const allTaxes = await db.select().from(taxes)
  const activeTaxes = allTaxes.filter((t) => t.isActive)
  const matchTax = (acctName: string): number | null => {
    const a = acctName.trim().toLowerCase()
    if (!a) return null
    const hit = activeTaxes.find((t) => {
      const n = t.name.trim().toLowerCase()
      return n && (a.includes(n) || n.includes(a))
    })
    return hit ? hit.id : null
  }

  // Step 2: create one transaction + N journal_lines per group.
  let txCreated = 0
  let lineCreated = 0
  let taxRecorded = 0
  const skipped: Array<{ date: string; description: string; reason: string }> =
    []
  for (const g of body.groups) {
    const allLines = [
      ...g.debits.map((l) => ({ ...l, side: "debit" as const })),
      ...g.credits.map((l) => ({ ...l, side: "credit" as const })),
    ]
    // Resolve account ids; skip if any name is unknown.
    const resolved = allLines.map((l) => ({
      ...l,
      account_id: byName.get(l.account.trim().toLowerCase()),
      tax_id: matchTax(l.account),
    }))
    const missing = resolved.find((l) => l.account_id == null)
    if (missing) {
      skipped.push({
        date: g.date,
        description: g.description,
        reason: `Unknown account: ${missing.account}`,
      })
      continue
    }

    // Pull tax-flavored lines out of the GL. Their amount becomes a
    // transaction_taxes record; the offsetting non-tax line on the
    // same side is bumped so debits = credits remain balanced
    // (gross-on-category instead of separate tax line).
    const taxLines = resolved.filter((l) => l.tax_id != null)
    const glLines = resolved.filter((l) => l.tax_id == null)

    const taxesByTaxId = new Map<
      number,
      { rate: number; tax_amount: number }
    >()
    for (const tl of taxLines) {
      const t = activeTaxes.find((x) => x.id === tl.tax_id)
      const rate = Number(t?.rate ?? 0)
      const prev = taxesByTaxId.get(tl.tax_id as number)
      taxesByTaxId.set(tl.tax_id as number, {
        rate,
        tax_amount: (prev?.tax_amount ?? 0) + tl.amount,
      })
    }

    // Bump the largest non-tax line on each side by the total tax
    // amount that came off that side. This preserves balance.
    const bump = (side: "debit" | "credit") => {
      const taxOnSide = taxLines
        .filter((l) => l.side === side)
        .reduce((s, l) => s + l.amount, 0)
      if (taxOnSide === 0) return
      const candidates = glLines.filter((l) => l.side === side)
      if (candidates.length === 0) {
        // No category line on this side to absorb — fall back: keep
        // the original tax line (ambiguous compound).
        const stragglers = taxLines.filter(
          (l) => l.side === side && l.tax_id != null,
        )
        glLines.push(...stragglers.map((l) => ({ ...l, tax_id: null })))
        return
      }
      const target = candidates.reduce((a, b) =>
        b.amount > a.amount ? b : a,
      )
      target.amount = +(target.amount + taxOnSide).toFixed(2)
    }
    bump("debit")
    bump("credit")

    const newDebits = glLines.filter((l) => l.side === "debit")
    const newCredits = glLines.filter((l) => l.side === "credit")
    const total = newDebits.reduce((s, l) => s + l.amount, 0)
    if (
      newDebits.length === 0 ||
      newCredits.length === 0 ||
      Math.abs(total - newCredits.reduce((s, l) => s + l.amount, 0)) > 0.01
    ) {
      // Couldn't safely collapse — fall back to the original lines.
      glLines.length = 0
      glLines.push(...resolved.map((l) => ({ ...l, tax_id: null })))
      taxesByTaxId.clear()
    }

    // Classify deposit / withdrawal / journal_entry from the post-bump
    // shape (so e.g. a Sales+GST deposit still classifies as deposit
    // even after we've stripped the GST line).
    const finalDebits = glLines.filter((l) => l.side === "debit")
    const finalCredits = glLines.filter((l) => l.side === "credit")
    const principal = <T extends { amount: number }>(lines: T[]): T =>
      lines.reduce((a, b) => (b.amount > a.amount ? b : a))
    const typeOf = (acct: string) =>
      typeByName.get(acct.trim().toLowerCase())
    const drPrincipal = typeOf(principal(finalDebits).account)
    const crPrincipal = typeOf(principal(finalCredits).account)
    const drTypes = finalDebits.map((l) => typeOf(l.account))
    const crTypes = finalCredits.map((l) => typeOf(l.account))
    let txnType = "journal_entry"
    if (drPrincipal === "asset" && crTypes.includes("income"))
      txnType = "deposit"
    else if (crPrincipal === "asset" && drTypes.includes("expense"))
      txnType = "withdrawal"

    const grossTotal = finalDebits.reduce((s, l) => s + l.amount, 0)
    const [tx] = await db
      .insert(transactions)
      .values({
        date: g.date,
        description: g.description || "(imported)",
        reference: body.reference ?? "Wave import",
        transactionType: txnType,
        amount: String(grossTotal),
      })
      .returning({ id: transactions.id })
    txCreated++
    await db.insert(journalLines).values(
      glLines.map((l) => ({
        transactionId: tx.id,
        accountId: l.account_id as number,
        debit: l.side === "debit" ? String(l.amount) : "0",
        credit: l.side === "credit" ? String(l.amount) : "0",
      })),
    )
    lineCreated += glLines.length

    if (taxesByTaxId.size > 0) {
      const taxRows = Array.from(taxesByTaxId.entries()).map(
        ([taxId, { rate, tax_amount }]) => ({
          transactionId: tx.id,
          taxId,
          rate: String(rate),
          taxAmount: String(+tax_amount.toFixed(2)),
          netAmount: String(+(grossTotal - tax_amount).toFixed(2)),
        }),
      )
      await db.insert(transactionTaxes).values(taxRows)
      taxRecorded += taxRows.length
    }
  }

  // Step 3: upsert categories (income / expense buckets that mirror the
  // chart of accounts). Dedup by lowercase name; existing rows untouched.
  const existingCategories = await db.select().from(categories)
  const catByName = new Set(
    existingCategories.map((c) => c.name.trim().toLowerCase()),
  )
  let catCreated = 0
  for (const c of body.categories) {
    const key = c.name.trim().toLowerCase()
    if (catByName.has(key)) continue
    await db
      .insert(categories)
      .values({ name: c.name.trim(), kind: c.kind })
    catByName.add(key)
    catCreated++
  }

  return NextResponse.json({
    accounts_created: accountsCreated.length,
    categories_created: catCreated,
    transactions_created: txCreated,
    lines_created: lineCreated,
    tax_records_created: taxRecorded,
    skipped,
  })
}

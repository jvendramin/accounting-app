import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  db,
  accounts,
  transactions,
  journalLines,
  categories,
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

  // Step 2: create one transaction + N journal_lines per group.
  let txCreated = 0
  let lineCreated = 0
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
    const total = g.debits.reduce((s, l) => s + l.amount, 0)
    // Determine a coarse transaction_type from the line shape, using the
    // *largest* line on each side as the principal account so compound
    // entries (sale → cash + tax, purchase → expense + GST input) still
    // classify correctly:
    // - principal debit is asset AND any credit is income → deposit
    //   (money flowing INTO the asset, with income recognised)
    // - principal credit is asset AND any debit is expense → withdrawal
    //   (money flowing OUT of the asset, against an expense)
    // - everything else (asset↔asset transfers, equity moves, refunds
    //   without an obvious principal) → journal_entry
    const principal = (lines: typeof g.debits) =>
      lines.reduce((a, b) => (b.amount > a.amount ? b : a))
    const typeOf = (acct: string) =>
      typeByName.get(acct.trim().toLowerCase())
    const drPrincipal = typeOf(principal(g.debits).account)
    const crPrincipal = typeOf(principal(g.credits).account)
    const drTypes = g.debits.map((l) => typeOf(l.account))
    const crTypes = g.credits.map((l) => typeOf(l.account))
    let txnType = "journal_entry"
    if (drPrincipal === "asset" && crTypes.includes("income"))
      txnType = "deposit"
    else if (crPrincipal === "asset" && drTypes.includes("expense"))
      txnType = "withdrawal"
    const [tx] = await db
      .insert(transactions)
      .values({
        date: g.date,
        description: g.description || "(imported)",
        reference: body.reference ?? "Wave import",
        transactionType: txnType,
        amount: String(total),
      })
      .returning({ id: transactions.id })
    txCreated++
    await db.insert(journalLines).values(
      resolved.map((l) => ({
        transactionId: tx.id,
        accountId: l.account_id as number,
        debit: l.side === "debit" ? String(l.amount) : "0",
        credit: l.side === "credit" ? String(l.amount) : "0",
      })),
    )
    lineCreated += resolved.length
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
    skipped,
  })
}

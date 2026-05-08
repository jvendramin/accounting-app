import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db, accounts, transactions, journalLines } from "@/lib/db"

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

const Input = z.object({
  accounts: z.array(AccountIn).min(1),
  groups: z.array(GroupIn).default([]),
  reference: z.string().optional(),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())

  // Step 1: upsert accounts by name. We don't blow away existing accounts —
  // just create the missing ones. Build a name → id map so journal lines
  // can resolve their account targets.
  const existing = await db.select().from(accounts)
  const byName = new Map<string, number>()
  for (const a of existing) byName.set(a.name.trim().toLowerCase(), a.id)

  const accountsCreated: Array<{ id: number; name: string }> = []
  for (const a of body.accounts) {
    const key = a.name.trim().toLowerCase()
    if (byName.has(key)) continue
    const [created] = await db
      .insert(accounts)
      .values({
        name: a.name.trim(),
        accountType: a.type,
      })
      .returning({ id: accounts.id, name: accounts.name })
    byName.set(key, created.id)
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
    // Determine a coarse transaction_type from the line shape so the existing
    // dashboard / reports rendering can colour-code rows. Single-debit /
    // single-credit pair where one side is an asset is a deposit/withdrawal;
    // anything else is a journal entry.
    const txnType = "journal_entry"
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

  return NextResponse.json({
    accounts_created: accountsCreated.length,
    transactions_created: txCreated,
    lines_created: lineCreated,
    skipped,
  })
}

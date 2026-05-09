import { NextResponse } from "next/server"
import { z } from "zod"
import { db, transactions, journalLines } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Accepts a list of approved Square-invoice suggestions plus the chosen
// principal asset/liability (where the money lands) and category (income
// account it offsets). Creates one deposit per row: principal Dr,
// category Cr, with the Square invoice id stored in `reference` so future
// syncs dedup cleanly.

const Item = z.object({
  square_id: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const Input = z.object({
  account_id: z.coerce.number().int(),
  category_id: z.coerce.number().int(),
  invoices: z.array(Item).min(1),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())
  let created = 0
  for (const inv of body.invoices) {
    const [tx] = await db
      .insert(transactions)
      .values({
        date: inv.paid_at,
        description: inv.description,
        reference: `Square invoice ${inv.square_id}`,
        transactionType: "deposit",
        amount: String(inv.amount),
      })
      .returning({ id: transactions.id })
    await db.insert(journalLines).values([
      {
        transactionId: tx.id,
        accountId: body.account_id,
        debit: String(inv.amount),
        credit: "0",
      },
      {
        transactionId: tx.id,
        accountId: body.category_id,
        debit: "0",
        credit: String(inv.amount),
      },
    ])
    created++
  }
  return NextResponse.json({ created })
}

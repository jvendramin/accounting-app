import { NextResponse } from "next/server"
import { z } from "zod"
import { db, transactions, journalLines } from "@/lib/db"

const Line = z.object({
  account_id: z.number(),
  debit: z.coerce.number(),
  credit: z.coerce.number(),
  memo: z.string().nullish(),
})
const Tx = z.object({
  date: z.string(),
  description: z.string(),
  reference: z.string().nullish(),
  transaction_type: z.enum(["deposit", "withdrawal", "journal_entry", "receipt"]),
  amount: z.coerce.number(),
  journal_lines_attributes: z.array(Line),
})

export async function POST(req: Request) {
  const body = z.object({ transactions: z.array(Tx) }).parse(await req.json())
  const created: number[] = []
  for (const t of body.transactions) {
    const [tx] = await db
      .insert(transactions)
      .values({
        date: t.date,
        description: t.description,
        reference: t.reference ?? null,
        transactionType: t.transaction_type,
        amount: String(t.amount),
      })
      .returning()
    if (t.journal_lines_attributes.length) {
      await db.insert(journalLines).values(
        t.journal_lines_attributes.map((l) => ({
          transactionId: tx.id,
          accountId: l.account_id,
          debit: String(l.debit ?? 0),
          credit: String(l.credit ?? 0),
          memo: l.memo ?? null,
        })),
      )
    }
    created.push(tx.id)
  }
  return NextResponse.json({ created }, { status: 201 })
}

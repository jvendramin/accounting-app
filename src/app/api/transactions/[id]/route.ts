import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db, transactions, journalLines } from "@/lib/db"

const Line = z.object({
  account_id: z.number(),
  debit: z.coerce.number(),
  credit: z.coerce.number(),
  memo: z.string().nullish(),
})
const Input = z.object({
  transaction: z.object({
    date: z.string().optional(),
    description: z.string().optional(),
    reference: z.string().nullish(),
    transaction_type: z
      .enum(["deposit", "withdrawal", "journal_entry", "receipt"])
      .optional(),
    amount: z.coerce.number().optional(),
    journal_lines_attributes: z.array(Line).optional(),
  }),
})

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const txId = Number(id)
  const body = Input.parse(await req.json())
  const t = body.transaction

  const [updated] = await db
    .update(transactions)
    .set({
      ...(t.date && { date: t.date }),
      ...(t.description && { description: t.description }),
      ...(t.reference !== undefined && { reference: t.reference }),
      ...(t.transaction_type && { transactionType: t.transaction_type }),
      ...(t.amount !== undefined && { amount: String(t.amount) }),
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, txId))
    .returning()

  // Replace journal lines if a new set was provided.
  if (t.journal_lines_attributes) {
    await db.delete(journalLines).where(eq(journalLines.transactionId, txId))
    if (t.journal_lines_attributes.length) {
      await db.insert(journalLines).values(
        t.journal_lines_attributes.map((l) => ({
          transactionId: txId,
          accountId: l.account_id,
          debit: String(l.debit ?? 0),
          credit: String(l.credit ?? 0),
          memo: l.memo ?? null,
        })),
      )
    }
  }
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const txId = Number(id)
  await db.delete(journalLines).where(eq(journalLines.transactionId, txId))
  await db.delete(transactions).where(eq(transactions.id, txId))
  return new NextResponse(null, { status: 204 })
}

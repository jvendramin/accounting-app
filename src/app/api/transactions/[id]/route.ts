import { NextResponse } from "next/server"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import {
  db,
  transactions,
  journalLines,
  taxes,
  transactionTaxes,
} from "@/lib/db"

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
    tax_ids: z.array(z.coerce.number()).optional(),
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
  // Replace tax breakdown if tax_ids provided. Deposit-only spec.
  if (t.tax_ids !== undefined) {
    await db
      .delete(transactionTaxes)
      .where(eq(transactionTaxes.transactionId, txId))
    const finalTotal =
      t.amount !== undefined ? Number(t.amount) : Number(updated.amount ?? 0)
    const finalType = t.transaction_type ?? updated.transactionType
    if (finalType === "deposit" && t.tax_ids.length > 0) {
      const found = await db
        .select()
        .from(taxes)
        .where(inArray(taxes.id, t.tax_ids))
      if (found.length > 0) {
        const sumRates = found.reduce((s, x) => s + Number(x.rate), 0)
        const net = finalTotal / (1 + sumRates)
        await db.insert(transactionTaxes).values(
          found.map((x) => ({
            transactionId: txId,
            taxId: x.id,
            rate: String(x.rate),
            taxAmount: String(+(net * Number(x.rate)).toFixed(2)),
            netAmount: String(+net.toFixed(2)),
          })),
        )
      }
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

import { NextResponse } from "next/server"
import { sql, and, eq, gte, lte, ilike, or, inArray } from "drizzle-orm"
import { z } from "zod"
import {
  db,
  transactions,
  journalLines,
  accounts,
  taxes,
  transactionTaxes,
} from "@/lib/db"

export const dynamic = "force-dynamic"

// GET /api/transactions?q=&type=&from=&to= — list with embedded journal lines
export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.trim()
  const type = url.searchParams.get("type")
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")

  const conds = [] as ReturnType<typeof eq>[]
  if (q)
    conds.push(
      or(
        ilike(transactions.description, `%${q}%`),
        ilike(transactions.reference, `%${q}%`),
      )!,
    )
  if (type) conds.push(eq(transactions.transactionType, type))
  if (from) conds.push(gte(transactions.date, from))
  if (to) conds.push(lte(transactions.date, to))

  const txs = await db
    .select()
    .from(transactions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`${transactions.date} desc, ${transactions.id} desc`)

  if (txs.length === 0) return NextResponse.json([])

  const txIds = txs.map((t) => t.id)
  const lineRows = await db
    .select({
      id: journalLines.id,
      transaction_id: journalLines.transactionId,
      account_id: journalLines.accountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
      memo: journalLines.memo,
      account_name: accounts.name,
    })
    .from(journalLines)
    .leftJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(inArray(journalLines.transactionId, txIds))
  const byTx = new Map<number, any[]>()
  for (const r of lineRows as any[]) {
    const arr = byTx.get(Number(r.transaction_id)) ?? []
    arr.push({
      id: Number(r.id),
      account_id: Number(r.account_id),
      account_name: r.account_name,
      debit: Number(r.debit),
      credit: Number(r.credit),
      memo: r.memo,
    })
    byTx.set(Number(r.transaction_id), arr)
  }

  // Tax breakdown per transaction
  const taxRows = await db
    .select()
    .from(transactionTaxes)
    .where(inArray(transactionTaxes.transactionId, txIds))
  const taxByTx = new Map<number, number[]>()
  const taxBreakdownByTx = new Map<number, any[]>()
  for (const r of taxRows) {
    const arr = taxByTx.get(r.transactionId) ?? []
    arr.push(r.taxId)
    taxByTx.set(r.transactionId, arr)
    const br = taxBreakdownByTx.get(r.transactionId) ?? []
    br.push({
      tax_id: r.taxId,
      rate: Number(r.rate),
      tax_amount: Number(r.taxAmount),
      net_amount: Number(r.netAmount),
    })
    taxBreakdownByTx.set(r.transactionId, br)
  }

  return NextResponse.json(
    txs.map((t) => ({
      ...t,
      amount: Number(t.amount ?? 0),
      journal_lines: byTx.get(t.id) ?? [],
      receipts: [],
      tax_ids: taxByTx.get(t.id) ?? [],
      tax_breakdown: taxBreakdownByTx.get(t.id) ?? [],
    })),
  )
}

const Line = z.object({
  account_id: z.number(),
  debit: z.coerce.number(),
  credit: z.coerce.number(),
  memo: z.string().nullish(),
})
const Input = z.object({
  transaction: z.object({
    date: z.string(),
    description: z.string(),
    reference: z.string().nullish(),
    transaction_type: z.enum([
      "deposit",
      "withdrawal",
      "journal_entry",
      "receipt",
    ]),
    amount: z.coerce.number(),
    journal_lines_attributes: z.array(Line),
    tax_ids: z.array(z.coerce.number()).optional(),
  }),
})

// Tax math (inclusive): grand total contains the taxes. Net = total / (1 + Σrates).
async function applyTaxes(
  txId: number,
  total: number,
  taxIds: number[] | undefined,
) {
  if (!taxIds || taxIds.length === 0) return
  const found = await db
    .select()
    .from(taxes)
    .where(inArray(taxes.id, taxIds))
  if (found.length === 0) return
  const sumRates = found.reduce((s, t) => s + Number(t.rate), 0)
  const net = total / (1 + sumRates)
  const rows = found.map((t) => {
    const taxAmount = +(net * Number(t.rate)).toFixed(2)
    return {
      transactionId: txId,
      taxId: t.id,
      rate: String(t.rate),
      taxAmount: String(taxAmount),
      netAmount: String(+net.toFixed(2)),
    }
  })
  await db.insert(transactionTaxes).values(rows)
}

export async function POST(req: Request) {
  const body = Input.parse(await req.json())
  const [tx] = await db
    .insert(transactions)
    .values({
      date: body.transaction.date,
      description: body.transaction.description,
      reference: body.transaction.reference ?? null,
      transactionType: body.transaction.transaction_type,
      amount: String(body.transaction.amount),
    })
    .returning()
  if (body.transaction.journal_lines_attributes.length) {
    await db.insert(journalLines).values(
      body.transaction.journal_lines_attributes.map((l) => ({
        transactionId: tx.id,
        accountId: l.account_id,
        debit: String(l.debit ?? 0),
        credit: String(l.credit ?? 0),
        memo: l.memo ?? null,
      })),
    )
  }
  // Tax breakdown applies to deposits only (per current spec).
  if (body.transaction.transaction_type === "deposit") {
    await applyTaxes(tx.id, body.transaction.amount, body.transaction.tax_ids)
  }
  return NextResponse.json(tx, { status: 201 })
}

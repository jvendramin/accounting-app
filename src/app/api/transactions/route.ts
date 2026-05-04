import { NextResponse } from "next/server"
import { sql, and, eq, gte, lte, ilike, or } from "drizzle-orm"
import { z } from "zod"
import { db, transactions, journalLines } from "@/lib/db"

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
  const linesRows = await db.execute(sql`
    select jl.id, jl.transaction_id, jl.account_id, jl.debit::float8 as debit,
           jl.credit::float8 as credit, jl.memo, a.name as account_name
    from journal_lines jl
    left join accounts a on a.id = jl.account_id
    where jl.transaction_id = any(${txIds})
  `)
  const byTx = new Map<number, any[]>()
  for (const r of linesRows.rows as any[]) {
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

  return NextResponse.json(
    txs.map((t) => ({
      ...t,
      amount: Number(t.amount ?? 0),
      journal_lines: byTx.get(t.id) ?? [],
      receipts: [],
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
  }),
})

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
  return NextResponse.json(tx, { status: 201 })
}

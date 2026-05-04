import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// Cashflow: change in cash/bank-asset accounts per month.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const where = sql`a.account_type='asset' ${from ? sql`and t.date >= ${from}::date` : sql``} ${to ? sql`and t.date <= ${to}::date` : sql``}`
  const rows = await db.execute(sql`
    select
      to_char(date_trunc('month', t.date), 'YYYY-MM') as month,
      sum(jl.debit)::float8 as inflow,
      sum(jl.credit)::float8 as outflow
    from journal_lines jl
    join accounts a on a.id = jl.account_id
    join transactions t on t.id = jl.transaction_id
    where ${where}
    group by 1
    order by 1
  `)
  const monthly = rows.rows.map((r: any) => ({
    month: r.month,
    inflow: Number(r.inflow),
    outflow: Number(r.outflow),
    net: Number(r.inflow) - Number(r.outflow),
  }))
  return NextResponse.json({ monthly })
}

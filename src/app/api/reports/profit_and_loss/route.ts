import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")

  const where = sql`true ${from ? sql`and t.date >= ${from}::date` : sql``} ${to ? sql`and t.date <= ${to}::date` : sql``}`

  // Sum income (credits-debits) and expense (debits-credits) totals
  const totals = await db.execute(sql`
    select
      coalesce(sum(case when a.account_type='income' then jl.credit - jl.debit else 0 end), 0)::float8 as total_income,
      coalesce(sum(case when a.account_type='expense' then jl.debit - jl.credit else 0 end), 0)::float8 as total_expense
    from journal_lines jl
    join accounts a on a.id = jl.account_id
    join transactions t on t.id = jl.transaction_id
    where ${where}
  `)
  const t = totals.rows[0] as { total_income: number; total_expense: number }

  const monthlyRows = await db.execute(sql`
    select
      to_char(date_trunc('month', t.date), 'YYYY-MM') as month,
      sum(case when a.account_type='income' then jl.credit - jl.debit else 0 end)::float8 as income,
      sum(case when a.account_type='expense' then jl.debit - jl.credit else 0 end)::float8 as expense
    from journal_lines jl
    join accounts a on a.id = jl.account_id
    join transactions t on t.id = jl.transaction_id
    where ${where}
    group by 1
    order by 1
  `)
  const monthly = monthlyRows.rows.map((r: any) => ({
    month: r.month,
    income: Number(r.income),
    expense: Number(r.expense),
    net: Number(r.income) - Number(r.expense),
  }))

  return NextResponse.json({
    total_income: t.total_income,
    total_expense: t.total_expense,
    net_income: t.total_income - t.total_expense,
    monthly,
  })
}

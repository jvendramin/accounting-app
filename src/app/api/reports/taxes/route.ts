import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// Tax collected per tax, per month, in the requested period.
// Includes both totals and a per-month breakdown.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const where = sql`true ${from ? sql`and t.date >= ${from}::date` : sql``} ${to ? sql`and t.date <= ${to}::date` : sql``}`

  const totals = await db.execute(sql`
    select
      tx.id    as tax_id,
      tx.name  as tax_name,
      tx.rate::float8  as rate,
      coalesce(sum(tt.tax_amount), 0)::float8 as collected,
      coalesce(sum(tt.net_amount), 0)::float8 as net,
      count(tt.id)::int as count
    from taxes tx
    left join transaction_taxes tt on tt.tax_id = tx.id
    left join transactions t on t.id = tt.transaction_id
    where ${where}
    group by tx.id
    order by tx.name
  `)

  const monthly = await db.execute(sql`
    select
      to_char(date_trunc('month', t.date), 'YYYY-MM') as month,
      tx.id    as tax_id,
      tx.name  as tax_name,
      coalesce(sum(tt.tax_amount), 0)::float8 as collected
    from transaction_taxes tt
    join transactions t on t.id = tt.transaction_id
    join taxes tx on tx.id = tt.tax_id
    where ${where}
    group by 1, tx.id
    order by 1, tx.name
  `)

  return NextResponse.json({ totals: totals.rows, monthly: monthly.rows })
}

import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// Suggested transactions: rows from "this calendar week, but one month ago".
// Useful as recurring-bill recommendations. We compare on date_part(week,...)
// against `now() - interval '1 month'` so a user landing on Mar 14 (week 11)
// sees their Feb 14 (week 7 of Feb but shifted) transactions — actually we
// match on the same week-of-year, one month back.
export async function GET() {
  const rows = await db.execute(sql`
    with target as (
      select (current_date - interval '1 month')::date as anchor
    )
    select
      t.id, t.date, t.description, t.reference, t.transaction_type, t.amount::float8 as amount,
      coalesce(json_agg(json_build_object(
        'id', jl.id,
        'account_id', jl.account_id,
        'account_name', a.name,
        'debit', jl.debit::float8,
        'credit', jl.credit::float8,
        'memo', jl.memo
      )) filter (where jl.id is not null), '[]') as journal_lines
    from transactions t
    cross join target
    left join journal_lines jl on jl.transaction_id = t.id
    left join accounts a on a.id = jl.account_id
    where t.date >= date_trunc('week', target.anchor)
      and t.date < date_trunc('week', target.anchor) + interval '7 days'
    group by t.id
    order by t.date asc, t.id asc
    limit 20
  `)
  return NextResponse.json(rows.rows)
}

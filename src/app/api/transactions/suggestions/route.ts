import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// Smart suggestions for the dashboard:
//  - rows from the same calendar week, one month ago
//  - that the user has NOT already entered this month (matched by description)
//  - with a recurrence count so the UI can show "seen N times before"
export async function GET() {
  const rows = await db.execute(sql`
    with target_week as (
      select date_trunc('week', current_date - interval '1 month')::date as start_d
    )
    select
      t.id, t.date, t.description, t.reference,
      t.transaction_type, t.amount::float8 as amount,
      (
        select count(*)::int from transactions t2
        where lower(t2.description) = lower(t.description)
          and t2.date <= t.date
      ) as occurrences,
      coalesce(json_agg(json_build_object(
        'id', jl.id,
        'account_id', jl.account_id,
        'account_name', a.name,
        'debit', jl.debit::float8,
        'credit', jl.credit::float8,
        'memo', jl.memo
      )) filter (where jl.id is not null), '[]') as journal_lines
    from transactions t
    cross join target_week tw
    left join journal_lines jl on jl.transaction_id = t.id
    left join accounts a on a.id = jl.account_id
    where t.date >= tw.start_d
      and t.date < tw.start_d + interval '7 days'
      and not exists (
        select 1 from transactions t2
        where lower(t2.description) = lower(t.description)
          and t2.date >= date_trunc('month', current_date)
      )
    group by t.id
    order by t.date asc, t.id asc
    limit 20
  `)
  return NextResponse.json(rows.rows)
}

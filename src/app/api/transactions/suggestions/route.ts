import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// Suggestions: rows from the same calendar week, one month ago, that the user
// has NOT dismissed for the current week. We *do not* hide rows already
// entered this month — instead we mark them so the UI can show them with an
// "Already created this month" cue. Hiding them was confusing: users wanted
// to keep seeing the recurring pattern even after acting on it.
export async function GET() {
  // 10 business days ≈ 14 calendar days. We anchor at "one month ago" and
  // include any transactions on or before the anchor, but no further back
  // than 14 days from it — covers a fortnight of activity.
  const rows = await db.execute(sql`
    with target_week as (
      select (current_date - interval '1 month')::date as anchor,
             ((current_date - interval '1 month') - interval '14 days')::date as start_d,
             date_trunc('week', current_date)::date as current_week
    )
    select
      t.id, t.date, t.description, t.reference,
      t.transaction_type, t.amount::float8 as amount,
      tw.current_week as target_week_start,
      (
        select count(*)::int from transactions t2
        where lower(t2.description) = lower(t.description)
          and t2.date <= t.date
      ) as occurrences,
      (
        select max(t2.date) from transactions t2
        where lower(t2.description) = lower(t.description)
          and t2.date >= date_trunc('month', current_date)
      ) as last_this_month,
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
      and t.date <= tw.anchor
      -- 10 business days = skip Saturdays (extract dow=6) and Sundays (dow=0)
      and extract(dow from t.date) not in (0, 6)
      and not exists (
        select 1 from dismissed_suggestions ds
        where ds.source_transaction_id = t.id
          and ds.dismissed_for_week_start = tw.current_week
      )
    group by t.id, tw.current_week
    -- Already-done items go to the bottom; recurring count breaks ties.
    order by (case when (
      select count(*) from transactions t2
      where lower(t2.description) = lower(t.description)
        and t2.date >= date_trunc('month', current_date)
    ) > 0 then 1 else 0 end) asc,
      t.date asc, t.id asc
    limit 20
  `)
  return NextResponse.json(rows.rows)
}

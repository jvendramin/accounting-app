import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// Balance sheet as of `as_of` date (or today): asset/liability/equity totals
// per account.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const asOf = url.searchParams.get("as_of")
  const cutoff = asOf ? sql`and t.date <= ${asOf}::date` : sql``

  const rows = await db.execute(sql`
    select
      a.id, a.name, a.code, a.account_type,
      coalesce(case
        when a.account_type='asset' then sum(jl.debit - jl.credit)
        else sum(jl.credit - jl.debit)
      end, 0)::float8 as balance
    from accounts a
    left join journal_lines jl on jl.account_id = a.id
    left join transactions t on t.id = jl.transaction_id ${cutoff}
    where a.account_type in ('asset','liability','equity')
    group by a.id
    order by a.account_type, a.code nulls last, a.id
  `)
  return NextResponse.json({
    accounts: rows.rows.map((r: any) => ({ ...r, balance: Number(r.balance) })),
  })
}

import { NextResponse } from "next/server"
import { sql, eq } from "drizzle-orm"
import { z } from "zod"
import { db, accounts, journalLines } from "@/lib/db"

export const dynamic = "force-dynamic"

// GET /api/accounts — list with computed balances
export async function GET() {
  // Pull each account and the sum of (debit - credit) across journal_lines
  // Sign convention follows the Rails app: balance = debits - credits for
  // asset/expense, credits - debits for liability/equity/income. Match it.
  const rows = await db.execute(sql`
    select
      a.id, a.name, a.code, a.account_type, a.description,
      a.created_at, a.updated_at,
      coalesce(case
        when a.account_type in ('asset','expense')
          then sum(jl.debit - jl.credit)
        else sum(jl.credit - jl.debit)
      end, 0)::numeric as balance
    from accounts a
    left join journal_lines jl on jl.account_id = a.id
    group by a.id
    order by a.code nulls last, a.id
  `)
  return NextResponse.json(
    rows.rows.map((r) => ({
      ...r,
      balance: Number(r.balance),
    })),
  )
}

const AccountInput = z.object({
  account: z.object({
    name: z.string().min(1),
    code: z.string().nullish(),
    account_type: z.enum(["asset", "liability", "equity", "income", "expense"]),
    description: z.string().nullish(),
  }),
})

export async function POST(req: Request) {
  const body = AccountInput.parse(await req.json())
  const [created] = await db
    .insert(accounts)
    .values({
      name: body.account.name,
      code: body.account.code ?? null,
      accountType: body.account.account_type,
      description: body.account.description ?? null,
    })
    .returning()
  return NextResponse.json(created, { status: 201 })
}

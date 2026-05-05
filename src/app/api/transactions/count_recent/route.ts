import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// Lightweight stat for sidebar badges. Returns count of transactions in the
// last 7 days (rolling window).
export async function GET() {
  const rows = await db.execute(sql`
    select count(*)::int as count
    from transactions
    where date >= (current_date - interval '7 days')
  `)
  const count = (rows.rows[0] as { count: number } | undefined)?.count ?? 0
  return NextResponse.json({ count })
}

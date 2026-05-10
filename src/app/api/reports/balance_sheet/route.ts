import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const asOf = url.searchParams.get("as_of")
  const r = await db.execute(sql`
    select rpc_report_balance_sheet(${asOf}::date) as payload
  `)
  return NextResponse.json((r.rows[0] as { payload: unknown }).payload)
}

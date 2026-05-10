import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const r = await db.execute(sql`
    select rpc_report_cashflow(${from}::date, ${to}::date) as payload
  `)
  return NextResponse.json((r.rows[0] as { payload: unknown }).payload)
}

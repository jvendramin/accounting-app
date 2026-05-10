import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// Thin pass-through to the rpc_report_profit_and_loss SQL function.
// Single source of truth — RN clients can call the RPC directly.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const r = await db.execute(sql`
    select rpc_report_profit_and_loss(${from}::date, ${to}::date) as payload
  `)
  return NextResponse.json((r.rows[0] as { payload: unknown }).payload)
}

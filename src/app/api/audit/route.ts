import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// GET /api/audit?limit=100 — recent activity across all audited tables.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10), 1),
    500,
  )
  const rows = await db.execute(sql`
    select id, table_name, row_id, op, changed_at, changed_by, old_data, new_data
    from audit_log
    order by changed_at desc, id desc
    limit ${limit}
  `)
  return NextResponse.json(rows.rows)
}

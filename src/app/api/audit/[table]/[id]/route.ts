import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// GET /api/audit/<table>/<row_id> — change history for a specific row.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ table: string; id: string }> },
) {
  const { table, id } = await ctx.params
  const allowed = new Set([
    "accounts",
    "categories",
    "transactions",
    "journal_lines",
  ])
  if (!allowed.has(table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 })
  }
  const rows = await db.execute(sql`
    select id, op, changed_at, changed_by, old_data, new_data
    from audit_log
    where table_name = ${table} and row_id = ${Number(id)}
    order by changed_at desc, id desc
    limit 200
  `)
  return NextResponse.json(rows.rows)
}

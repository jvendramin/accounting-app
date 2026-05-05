import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"

const Input = z.object({ ids: z.array(z.number()).min(1) })

export async function POST(req: Request) {
  const { ids } = Input.parse(await req.json())
  // Dismiss for the current Monday-of-week. The unique constraint silently
  // suppresses duplicates if the user dismisses twice.
  await db.execute(sql`
    insert into dismissed_suggestions (source_transaction_id, dismissed_for_week_start)
    select unnest(${ids}::bigint[]), date_trunc('week', current_date)::date
    on conflict do nothing
  `)
  return new NextResponse(null, { status: 204 })
}

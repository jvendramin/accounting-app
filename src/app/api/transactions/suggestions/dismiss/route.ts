import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"

// Bigint ids round-trip through the Neon HTTP driver as strings, so the
// suggestion list passes them back as strings too. Coerce on the way in.
const Input = z.object({ ids: z.array(z.coerce.number().int()).min(1) })

export async function POST(req: Request) {
  const { ids } = Input.parse(await req.json())
  // Dismiss for the current Monday-of-week. The unique constraint silently
  // suppresses duplicates if the user dismisses twice.
  // Build a multi-row VALUES list — the Neon HTTP driver doesn't reliably
  // serialise a JS array placeholder as `::bigint[]`, so passing each id as
  // its own bound parameter sidesteps that codepath entirely.
  const rows = sql.join(
    ids.map(
      (id) => sql`(${id}, date_trunc('week', current_date)::date)`,
    ),
    sql`, `,
  )
  await db.execute(sql`
    insert into dismissed_suggestions (source_transaction_id, dismissed_for_week_start)
    values ${rows}
    on conflict do nothing
  `)
  return new NextResponse(null, { status: 204 })
}

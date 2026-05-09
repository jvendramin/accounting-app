import { NextResponse } from "next/server"
import { z } from "zod"
import { inArray } from "drizzle-orm"
import { db, squareIgnoredInvoices } from "@/lib/db"

export const dynamic = "force-dynamic"

const Input = z.object({
  square_ids: z.array(z.string().min(1)).min(1),
})

export async function GET() {
  const rows = await db.select().from(squareIgnoredInvoices)
  return NextResponse.json({
    ignored: rows.map((r) => ({
      square_id: r.squareId,
      ignored_at: r.ignoredAt,
    })),
  })
}

export async function POST(req: Request) {
  const body = Input.parse(await req.json())
  await db
    .insert(squareIgnoredInvoices)
    .values(body.square_ids.map((id) => ({ squareId: id })))
    .onConflictDoNothing()
  return NextResponse.json({ ignored: body.square_ids.length })
}

export async function DELETE(req: Request) {
  const body = Input.parse(await req.json())
  await db
    .delete(squareIgnoredInvoices)
    .where(inArray(squareIgnoredInvoices.squareId, body.square_ids))
  return NextResponse.json({ unignored: body.square_ids.length })
}

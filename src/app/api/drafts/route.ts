import { NextResponse } from "next/server"
import { desc } from "drizzle-orm"
import { z } from "zod"
import { db, transactionDrafts } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const rows = await db
    .select()
    .from(transactionDrafts)
    .orderBy(desc(transactionDrafts.updatedAt))
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      payload: JSON.parse(r.payload),
      user_sub: r.userSub,
      updated_at: r.updatedAt,
      created_at: r.createdAt,
    })),
  )
}

const Input = z.object({
  draft: z.object({
    name: z.string().min(1),
    payload: z.record(z.string(), z.any()),
    user_sub: z.string().nullish(),
  }),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())
  const [created] = await db
    .insert(transactionDrafts)
    .values({
      name: body.draft.name,
      payload: JSON.stringify(body.draft.payload),
      userSub: body.draft.user_sub ?? null,
    })
    .returning()
  return NextResponse.json(created, { status: 201 })
}

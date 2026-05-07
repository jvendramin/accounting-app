import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db, transactionDrafts } from "@/lib/db"

const Update = z.object({
  draft: z.object({
    name: z.string().min(1).optional(),
    payload: z.record(z.string(), z.any()).optional(),
  }),
})

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const body = Update.parse(await req.json())
  const [updated] = await db
    .update(transactionDrafts)
    .set({
      ...(body.draft.name && { name: body.draft.name }),
      ...(body.draft.payload && {
        payload: JSON.stringify(body.draft.payload),
      }),
      updatedAt: new Date(),
    })
    .where(eq(transactionDrafts.id, Number(id)))
    .returning()
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  await db
    .delete(transactionDrafts)
    .where(eq(transactionDrafts.id, Number(id)))
  return new NextResponse(null, { status: 204 })
}

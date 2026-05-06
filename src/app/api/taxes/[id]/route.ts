import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db, taxes } from "@/lib/db"

const Update = z.object({
  tax: z.object({
    name: z.string().min(1).optional(),
    rate: z.coerce.number().min(0).max(1).optional(),
    description: z.string().nullish(),
    is_active: z.boolean().optional(),
  }),
})

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const body = Update.parse(await req.json())
  const t = body.tax
  const [updated] = await db
    .update(taxes)
    .set({
      ...(t.name && { name: t.name }),
      ...(t.rate !== undefined && { rate: String(t.rate) }),
      ...(t.description !== undefined && { description: t.description }),
      ...(t.is_active !== undefined && { isActive: t.is_active }),
      updatedAt: new Date(),
    })
    .where(eq(taxes.id, Number(id)))
    .returning()
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  await db.delete(taxes).where(eq(taxes.id, Number(id)))
  return new NextResponse(null, { status: 204 })
}

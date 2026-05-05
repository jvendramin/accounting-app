import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db, categories } from "@/lib/db"

const Update = z.object({
  category: z.object({
    name: z.string().min(1).optional(),
    kind: z.enum(["income", "expense"]).optional(),
    color: z.string().nullish(),
    description: z.string().nullish(),
  }),
})

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const body = Update.parse(await req.json())
  const [updated] = await db
    .update(categories)
    .set({
      ...(body.category.name && { name: body.category.name }),
      ...(body.category.kind && { kind: body.category.kind }),
      ...(body.category.color !== undefined && { color: body.category.color }),
      ...(body.category.description !== undefined && {
        description: body.category.description,
      }),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, Number(id)))
    .returning()
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  await db.delete(categories).where(eq(categories.id, Number(id)))
  return new NextResponse(null, { status: 204 })
}

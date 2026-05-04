import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db, accounts } from "@/lib/db"

const Update = z.object({
  account: z.object({
    name: z.string().min(1).optional(),
    code: z.string().nullish(),
    account_type: z
      .enum(["asset", "liability", "equity", "income", "expense"])
      .optional(),
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
    .update(accounts)
    .set({
      ...(body.account.name && { name: body.account.name }),
      ...(body.account.code !== undefined && { code: body.account.code }),
      ...(body.account.account_type && {
        accountType: body.account.account_type,
      }),
      ...(body.account.description !== undefined && {
        description: body.account.description,
      }),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, Number(id)))
    .returning()
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  await db.delete(accounts).where(eq(accounts.id, Number(id)))
  return new NextResponse(null, { status: 204 })
}

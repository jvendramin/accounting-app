import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db, receipts } from "@/lib/db"

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  await db.delete(receipts).where(eq(receipts.id, Number(id)))
  return new NextResponse(null, { status: 204 })
}

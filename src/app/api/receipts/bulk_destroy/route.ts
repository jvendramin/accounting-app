import { NextResponse } from "next/server"
import { inArray } from "drizzle-orm"
import { z } from "zod"
import { db, receipts } from "@/lib/db"

export async function POST(req: Request) {
  const { ids } = z.object({ ids: z.array(z.number()) }).parse(await req.json())
  await db.delete(receipts).where(inArray(receipts.id, ids))
  return new NextResponse(null, { status: 204 })
}

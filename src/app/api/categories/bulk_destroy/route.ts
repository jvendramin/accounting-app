import { NextResponse } from "next/server"
import { inArray } from "drizzle-orm"
import { z } from "zod"
import { db, categories } from "@/lib/db"

export async function POST(req: Request) {
  const { ids } = z.object({ ids: z.array(z.coerce.number().int()) }).parse(await req.json())
  await db.delete(categories).where(inArray(categories.id, ids))
  return new NextResponse(null, { status: 204 })
}

import { NextResponse } from "next/server"
import { inArray } from "drizzle-orm"
import { z } from "zod"
import { db, accounts } from "@/lib/db"

export async function POST(req: Request) {
  const { ids } = z.object({ ids: z.array(z.number()) }).parse(await req.json())
  await db.delete(accounts).where(inArray(accounts.id, ids))
  return new NextResponse(null, { status: 204 })
}

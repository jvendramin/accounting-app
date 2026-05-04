import { NextResponse } from "next/server"
import { inArray } from "drizzle-orm"
import { z } from "zod"
import { db, transactions, journalLines } from "@/lib/db"

export async function POST(req: Request) {
  const { ids } = z.object({ ids: z.array(z.number()) }).parse(await req.json())
  await db.delete(journalLines).where(inArray(journalLines.transactionId, ids))
  await db.delete(transactions).where(inArray(transactions.id, ids))
  return new NextResponse(null, { status: 204 })
}

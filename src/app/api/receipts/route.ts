import { NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"
import { db, receipts } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const userSub = url.searchParams.get("user_sub")
  const rows = userSub
    ? await db
        .select()
        .from(receipts)
        .where(eq(receipts.uploaderSub, userSub))
        .orderBy(desc(receipts.createdAt))
    : await db.select().from(receipts).orderBy(desc(receipts.createdAt))
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      content_type: r.contentType,
      byte_size: r.byteSize,
      storage_key: r.storageKey,
      transaction_id: r.transactionId,
      uploader_sub: r.uploaderSub,
      created_at: r.createdAt,
    })),
  )
}

const Input = z.object({
  receipt: z.object({
    filename: z.string().nullish(),
    content_type: z.string().nullish(),
    byte_size: z.coerce.number().nullish(),
    storage_key: z.string().nullish(),
    transaction_id: z.coerce.number().nullish(),
    uploader_sub: z.string().nullish(),
  }),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())
  const r = body.receipt
  const [created] = await db
    .insert(receipts)
    .values({
      filename: r.filename ?? null,
      contentType: r.content_type ?? null,
      byteSize: r.byte_size ?? 0,
      storageKey: r.storage_key ?? null,
      transactionId: r.transaction_id ?? null,
      uploaderSub: r.uploader_sub ?? null,
    })
    .returning()
  return NextResponse.json(created, { status: 201 })
}

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
        .where(eq(receipts.userSub, userSub))
        .orderBy(desc(receipts.createdAt))
    : await db.select().from(receipts).orderBy(desc(receipts.createdAt))
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      content_type: r.contentType,
      byte_size: r.size, // legacy field name kept for client compat
      storage_key: r.s3Key,
      url: r.url,
      transaction_id: r.transactionId,
      uploader_sub: r.userSub,
      folder: r.folder,
      bucket: r.bucket,
      etag: r.etag,
      analyzed_at: r.analyzedAt,
      created_at: r.createdAt,
    })),
  )
}

const Input = z.object({
  receipt: z.object({
    filename: z.string().min(1),
    content_type: z.string().nullish(),
    byte_size: z.coerce.number().nullish(),
    storage_key: z.string().nullish(),
    url: z.string().nullish(),
    transaction_id: z.coerce.number().nullish(),
    uploader_sub: z.string().nullish(),
    folder: z.string().nullish(),
    bucket: z.string().nullish(),
    etag: z.string().nullish(),
  }),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())
  const r = body.receipt
  const [created] = await db
    .insert(receipts)
    .values({
      filename: r.filename,
      contentType: r.content_type ?? null,
      size: r.byte_size ?? null,
      s3Key: r.storage_key ?? null,
      url: r.url ?? null,
      transactionId: r.transaction_id ?? null,
      userSub: r.uploader_sub ?? null,
      folder: r.folder ?? null,
      bucket: r.bucket ?? null,
      etag: r.etag ?? null,
    })
    .returning()
  return NextResponse.json(created, { status: 201 })
}

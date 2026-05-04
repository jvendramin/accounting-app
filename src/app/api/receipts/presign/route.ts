import { NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { z } from "zod"
import { randomUUID } from "crypto"

const Input = z.object({
  filename: z.string(),
  content_type: z.string().optional(),
  user_sub: z.string().optional(),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const region = process.env.S3_REGION
  const rawEndpoint = process.env.S3_ENDPOINT

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      { error: "S3 not configured. Set S3_* env vars." },
      { status: 503 },
    )
  }

  const endpoint = rawEndpoint
    ? rawEndpoint.match(/^https?:\/\//i)
      ? rawEndpoint
      : `https://${rawEndpoint}`
    : undefined

  const s3 = new S3Client({
    region: region ?? "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    forcePathStyle: !!endpoint,
  })

  const userSub = body.user_sub || "anonymous"
  const folder = `receipts/${userSub}`
  const key = `${folder}/${randomUUID()}-${body.filename}`

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: body.content_type ?? "application/octet-stream",
    }),
    { expiresIn: 600 },
  )

  const publicUrl = endpoint
    ? `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`

  return NextResponse.json({
    upload_url: url,
    key,
    folder,
    bucket,
    public_url: publicUrl,
  })
}

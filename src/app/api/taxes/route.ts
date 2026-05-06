import { NextResponse } from "next/server"
import { asc } from "drizzle-orm"
import { z } from "zod"
import { db, taxes } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const rows = await db.select().from(taxes).orderBy(asc(taxes.name))
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      rate: Number(r.rate),
      description: r.description,
      is_active: r.isActive,
      created_at: r.createdAt,
    })),
  )
}

const Input = z.object({
  tax: z.object({
    name: z.string().min(1),
    rate: z.coerce.number().min(0).max(1),
    description: z.string().nullish(),
    is_active: z.boolean().optional(),
  }),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())
  const [created] = await db
    .insert(taxes)
    .values({
      name: body.tax.name,
      rate: String(body.tax.rate),
      description: body.tax.description ?? null,
      isActive: body.tax.is_active ?? true,
    })
    .returning()
  return NextResponse.json(created, { status: 201 })
}

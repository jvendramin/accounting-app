import { NextResponse } from "next/server"
import { asc } from "drizzle-orm"
import { z } from "zod"
import { db, categories } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const rows = await db.select().from(categories).orderBy(asc(categories.kind), asc(categories.name))
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      color: r.color,
      description: r.description,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    })),
  )
}

const Input = z.object({
  category: z.object({
    name: z.string().min(1),
    kind: z.enum(["income", "expense"]),
    color: z.string().nullish(),
    description: z.string().nullish(),
  }),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())
  const [created] = await db
    .insert(categories)
    .values({
      name: body.category.name,
      kind: body.category.kind,
      color: body.category.color ?? null,
      description: body.category.description ?? null,
    })
    .returning()
  return NextResponse.json(created, { status: 201 })
}

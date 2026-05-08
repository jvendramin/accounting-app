import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db, categories } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Wave's "Categories" are just the income + expense accounts in the Chart
// of Accounts. The client filters its already-parsed Wave CSV down to those
// and posts the names + kind here; we upsert by name (case-insensitive) so
// re-running the import doesn't duplicate.

const Input = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.enum(["income", "expense"]),
        description: z.string().nullish(),
      }),
    )
    .min(1),
})

export async function POST(req: Request) {
  const body = Input.parse(await req.json())

  const existing = await db.select().from(categories)
  const byName = new Map<string, number>()
  for (const c of existing) byName.set(c.name.trim().toLowerCase(), c.id)

  let created = 0
  let skipped = 0
  for (const c of body.categories) {
    const key = c.name.trim().toLowerCase()
    if (byName.has(key)) {
      skipped++
      continue
    }
    await db.insert(categories).values({
      name: c.name.trim(),
      kind: c.kind,
      description: c.description ?? null,
    })
    created++
  }

  return NextResponse.json({ created, skipped })
}

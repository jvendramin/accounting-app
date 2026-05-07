import { NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"
import { db, userPreferences } from "@/lib/db"

export const dynamic = "force-dynamic"

const Prefs = z.object({
  personal: z.record(z.string(), z.any()).default({}),
  business: z.record(z.string(), z.any()).default({}),
  app: z.record(z.string(), z.any()).default({}),
})

const Input = z.object({
  user_sub: z.string().min(1),
  prefs: Prefs,
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const userSub = url.searchParams.get("user_sub")
  if (!userSub) {
    return NextResponse.json(
      { personal: {}, business: {}, app: {} },
      { status: 200 },
    )
  }
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userSub, userSub))
  if (!row)
    return NextResponse.json(
      { personal: {}, business: {}, app: {} },
      { status: 200 },
    )
  let parsed: any = {}
  try {
    parsed = typeof row.prefs === "string" ? JSON.parse(row.prefs) : row.prefs
  } catch {
    parsed = {}
  }
  return NextResponse.json({
    personal: parsed.personal ?? {},
    business: parsed.business ?? {},
    app: parsed.app ?? {},
  })
}

export async function PUT(req: Request) {
  const body = Input.parse(await req.json())
  const payload = JSON.stringify(body.prefs)
  // Upsert by user_sub PK.
  await db
    .insert(userPreferences)
    .values({ userSub: body.user_sub, prefs: payload, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferences.userSub,
      set: { prefs: payload, updatedAt: sql`now()` },
    })
  return NextResponse.json({ ok: true })
}

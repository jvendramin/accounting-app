import { NextResponse } from "next/server"
import { inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { db, accounts, journalLines } from "@/lib/db"

// Bigint ids round-trip through the Neon HTTP driver as strings, so coerce
// on the way in.
const Input = z.object({ ids: z.array(z.coerce.number().int()).min(1) })

export async function POST(req: Request) {
  const { ids } = Input.parse(await req.json())

  // Pre-flight FK check: any journal_lines pointing at these accounts? If
  // so, return a useful 409 with the conflict count instead of letting
  // Postgres fire a generic FK violation.
  const inUse = await db
    .select({
      account_id: journalLines.accountId,
      n: sql<number>`count(*)::int`,
    })
    .from(journalLines)
    .where(inArray(journalLines.accountId, ids))
    .groupBy(journalLines.accountId)

  if (inUse.length > 0) {
    const total = inUse.reduce((s, r) => s + Number(r.n), 0)
    const blocked = inUse.map((r) => r.account_id)
    return NextResponse.json(
      {
        code: "ACCOUNT_IN_USE",
        message: `${blocked.length} account(s) can't be deleted because they're referenced by ${total} journal line(s). Reassign or delete those transactions first.`,
        blocked,
      },
      { status: 409 },
    )
  }

  await db.delete(accounts).where(inArray(accounts.id, ids))
  return new NextResponse(null, { status: 204 })
}

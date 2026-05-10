import { NextResponse } from "next/server"
import { parseWaveCsv } from "@/lib/wave-import"

// Server-side parse so the RN client doesn't need a JS port of the
// Wave CSV parser. Body: raw CSV text. Response: same shape the
// /integrations/wave page builds today (accounts + groups +
// ambiguous + warnings).
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  const text = await req.text()
  if (!text || text.length < 10) {
    return NextResponse.json(
      { error: "Empty CSV body" },
      { status: 400 },
    )
  }
  try {
    const result = parseWaveCsv(text)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json(
      { error: "Parse failed", detail: e?.message ?? String(e) },
      { status: 500 },
    )
  }
}

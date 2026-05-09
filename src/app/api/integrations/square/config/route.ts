import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Tells the UI whether server-side Square credentials are configured.
// Never returns the token itself — only a boolean and a hint of which
// environment we'd hit by default.
export async function GET() {
  return NextResponse.json({
    has_token: Boolean(process.env.SQUARE_ACCESS_TOKEN),
    environment:
      (process.env.SQUARE_ENVIRONMENT as "production" | "sandbox") ||
      "production",
  })
}

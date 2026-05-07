import { NextResponse } from "next/server"

// Same-origin proxy to Neon Auth. iOS Safari standalone (PWA) can refuse to
// store / send 3rd-party cookies and sometimes blocks cross-origin auth
// requests entirely; routing every auth call through /api/auth/* keeps
// everything first-party so Better Auth's React adapter behaves identically
// in the browser and in the installed PWA.

const UPSTREAM = process.env.NEON_AUTH_URL ?? process.env.NEXT_PUBLIC_NEON_AUTH_URL

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function forward(req: Request, slug: string[]) {
  if (!UPSTREAM) {
    return NextResponse.json(
      { code: "AUTH_PROXY_UNCONFIGURED", message: "Auth URL not configured" },
      { status: 500 },
    )
  }
  const url = new URL(req.url)
  const target = `${UPSTREAM}/${slug.join("/")}${url.search}`

  // Strip hop-by-hop headers; preserve everything else verbatim so Better
  // Auth still sees Origin/User-Agent/etc.
  const fwdHeaders = new Headers(req.headers)
  fwdHeaders.delete("host")
  fwdHeaders.delete("content-length")
  fwdHeaders.delete("connection")
  // Forward Cookie verbatim — Better Auth uses cookies for session lookup
  // and we already rewrote the Set-Cookie domain on the response side, so
  // the same opaque cookie value travels back here on subsequent requests.
  // Same reason we keep Referer — upstream may use it but doesn't reject on
  // it; only x-forwarded-host (below) caused a 400 in testing.
  // Vercel injects x-forwarded-* and x-vercel-* on every server request.
  // Better Auth uses x-forwarded-host to derive its trusted host and rejects
  // (HTTP 400) when it sees our Vercel hostname. Drop the whole family.
  for (const name of [...fwdHeaders.keys()]) {
    if (name.startsWith("x-forwarded-") || name.startsWith("x-vercel-")) {
      fwdHeaders.delete(name)
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers: fwdHeaders,
    redirect: "manual",
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer()
  }

  const res = await fetch(target, init)

  // Copy headers, but rewrite Set-Cookie domain so cookies are pinned to the
  // app's own origin instead of Neon's subdomain.
  const outHeaders = new Headers()
  res.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    // Node fetch auto-decompresses the body, so the original
    // content-encoding/content-length no longer match what we forward.
    // Letting the browser see them causes a "decoding failed" error and the
    // app can't read the response.
    if (k === "content-encoding" || k === "content-length") return
    if (k === "set-cookie") {
      const cleaned = value
        .replace(/;\s*Domain=[^;]+/i, "")
        .replace(/;\s*SameSite=None/i, "; SameSite=Lax")
      outHeaders.append("set-cookie", cleaned)
    } else {
      outHeaders.set(key, value)
    }
  })

  return new NextResponse(res.body, {
    status: res.status,
    headers: outHeaders,
  })
}

type Ctx = { params: Promise<{ slug: string[] }> }

export async function GET(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params
  return forward(req, slug)
}
export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params
  return forward(req, slug)
}
export async function PUT(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params
  return forward(req, slug)
}
export async function PATCH(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params
  return forward(req, slug)
}
export async function DELETE(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params
  return forward(req, slug)
}
export async function OPTIONS(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params
  return forward(req, slug)
}

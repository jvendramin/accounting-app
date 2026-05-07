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
  // Cookies in the browser are scoped to our Vercel host, NOT to Neon's
  // subdomain. Forwarding them upstream confuses Better Auth (returns 400).
  // Better Auth's React adapter uses Bearer tokens (Authorization header),
  // so dropping Cookie is safe and required.
  fwdHeaders.delete("cookie")
  // Same reason for Referer — upstream may reject when it doesn't match its
  // own host.
  fwdHeaders.delete("referer")
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
    if (key.toLowerCase() === "set-cookie") {
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

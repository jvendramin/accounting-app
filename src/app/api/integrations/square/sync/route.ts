import { NextResponse } from "next/server"
import { z } from "zod"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

// Pull paid Square invoices and diff them against existing transactions.
// Dedup key: the Square invoice id is stored in transactions.reference as
// `Square invoice <id>`. We also fall back to (date, |amount|) matching so
// invoices imported manually (or via Wave) don't reappear as suggestions.

const Input = z.object({
  // Both optional; if omitted we fall back to SQUARE_ACCESS_TOKEN /
  // SQUARE_ENVIRONMENT env vars so the user doesn't have to paste a
  // token every time the page is opened.
  access_token: z.string().min(10).optional(),
  environment: z.enum(["production", "sandbox"]).optional(),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const HOSTS = {
  production: "https://connect.squareup.com",
  sandbox: "https://connect.squareupsandbox.com",
}

const SQUARE_VERSION = "2025-04-16"

type SquareLocation = { id: string; name?: string }

type SquareInvoiceSearchResp = {
  invoices?: SquareInvoice[]
  cursor?: string
  errors?: { code?: string; detail?: string }[]
}

type SquareInvoice = {
  id: string
  status?: string
  invoice_number?: string
  title?: string
  description?: string
  payment_requests?: Array<{
    computed_amount_money?: { amount: number; currency: string }
    total_completed_amount_money?: { amount: number; currency: string }
    due_date?: string
  }>
  primary_recipient?: {
    customer_id?: string
    given_name?: string
    family_name?: string
    company_name?: string
    email_address?: string
  }
  created_at?: string
  updated_at?: string
  // Square API doesn't always populate `paid_at`; fall back to updated_at
  // for paid invoices.
}

export async function POST(req: Request) {
  const body = Input.parse(await req.json().catch(() => ({})))
  const accessToken = body.access_token ?? process.env.SQUARE_ACCESS_TOKEN
  const environment =
    body.environment ??
    ((process.env.SQUARE_ENVIRONMENT as "production" | "sandbox") ||
      "production")
  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "No Square access token. Set SQUARE_ACCESS_TOKEN in .env.local or pass access_token in the request body.",
      },
      { status: 400 },
    )
  }
  const host = HOSTS[environment]

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Square-Version": SQUARE_VERSION,
    "Content-Type": "application/json",
  }

  // 1. Look up locations — invoice search needs at least one.
  const locResp = await fetch(`${host}/v2/locations`, { headers })
  if (!locResp.ok) {
    const text = await locResp.text()
    return NextResponse.json(
      { error: "Square auth failed", detail: text.slice(0, 400) },
      { status: 401 },
    )
  }
  const locData = (await locResp.json()) as { locations?: SquareLocation[] }
  const locationIds = (locData.locations ?? []).map((l) => l.id)
  if (locationIds.length === 0) {
    return NextResponse.json({
      invoices: [],
      counts: { fetched: 0, new: 0, existing: 0 },
    })
  }

  // 2. Search invoices, paginate cursor.
  const invoices: SquareInvoice[] = []
  let cursor: string | undefined
  do {
    const r: Response = await fetch(`${host}/v2/invoices/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: {
          filter: { location_ids: locationIds },
          sort: { field: "INVOICE_SORT_DATE", order: "DESC" },
        },
        cursor,
        limit: 100,
      }),
    })
    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json(
        { error: "Square invoice search failed", detail: text.slice(0, 400) },
        { status: 502 },
      )
    }
    const j = (await r.json()) as SquareInvoiceSearchResp
    if (j.errors?.length) {
      return NextResponse.json(
        { error: "Square error", detail: j.errors[0].detail ?? "unknown" },
        { status: 502 },
      )
    }
    if (j.invoices) invoices.push(...j.invoices)
    cursor = j.cursor
  } while (cursor)

  // 3. Filter to paid (status PAID or has total_completed_amount_money > 0).
  const paid = invoices
    .filter((inv) => {
      const completed = (inv.payment_requests ?? []).reduce(
        (s, pr) => s + (pr.total_completed_amount_money?.amount ?? 0),
        0,
      )
      return inv.status === "PAID" || completed > 0
    })
    .filter((inv) => {
      if (!body.since) return true
      const ts = inv.updated_at ?? inv.created_at
      return ts ? ts.slice(0, 10) >= body.since : true
    })

  // 4. Dedup: any deposit whose amount matches an invoice's gross AND
  //    whose date falls within ±7 days of the paid date counts as
  //    "already imported". We deliberately ignore description /
  //    reference — the user wants a pure (date, amount) signal so
  //    manually-entered deposits or differently-described imports
  //    still match.
  const existing = await db.execute(sql`
    select id, date, amount, description, reference
      from transactions where transaction_type = 'deposit'
  `)
  type DepositRow = {
    id: number
    days: number
    amount: string
    date: string
    description: string
    reference: string | null
  }
  const deposits: DepositRow[] = (existing.rows as Array<{
    id: string | number
    date: string
    amount: string
    description: string
    reference: string | null
  }>).map((r) => ({
    id: Number(r.id),
    // Days since epoch — cheap integer comparison instead of date
    // arithmetic on every dedup check.
    days: Math.floor(new Date(r.date + "T00:00:00Z").getTime() / 86400000),
    amount: Number(r.amount).toFixed(2),
    date: r.date,
    description: r.description,
    reference: r.reference,
  }))
  const findMatch = (
    paidAt: string,
    amount: number,
  ): DepositRow | null => {
    if (!paidAt) return null
    const target = Math.floor(
      new Date(paidAt + "T00:00:00Z").getTime() / 86400000,
    )
    const amtKey = amount.toFixed(2)
    // Pick the closest by date when multiple deposits could match.
    let best: DepositRow | null = null
    let bestDelta = Infinity
    for (const d of deposits) {
      if (d.amount !== amtKey) continue
      const delta = Math.abs(d.days - target)
      if (delta > 7) continue
      if (delta < bestDelta) {
        best = d
        bestDelta = delta
      }
    }
    return best
  }

  // 5. Shape the response: { suggestions, counts }.
  type Suggestion = {
    square_id: string
    invoice_number?: string
    title: string
    description: string
    amount: number
    paid_at: string
    customer: string
    already_imported: boolean
    matched?: {
      id: number
      date: string
      description: string
      amount: number
      reference: string | null
    } | null
  }
  const suggestions: Suggestion[] = paid
    .map((inv) => {
      const completed = (inv.payment_requests ?? []).reduce(
        (s, pr) => s + (pr.total_completed_amount_money?.amount ?? 0),
        0,
      )
      // Square reports money in cents.
      const amount = +(completed / 100).toFixed(2)
      const paidAt = (inv.updated_at ?? inv.created_at ?? "").slice(0, 10)
      const customerParts = [
        inv.primary_recipient?.company_name,
        inv.primary_recipient?.given_name,
        inv.primary_recipient?.family_name,
      ].filter(Boolean)
      const customer = customerParts.join(" ").trim()
      const title =
        inv.title?.trim() ||
        (inv.invoice_number ? `Invoice ${inv.invoice_number}` : "(no title)")
      const desc = [title, customer ? `— ${customer}` : ""]
        .filter(Boolean)
        .join(" ")
      const matched = findMatch(paidAt, amount)
      const already = matched !== null
      return {
        square_id: inv.id,
        invoice_number: inv.invoice_number,
        title,
        description: desc,
        amount,
        paid_at: paidAt,
        customer,
        already_imported: already,
        matched: matched
          ? {
              id: matched.id,
              date: matched.date,
              description: matched.description,
              amount: Number(matched.amount),
              reference: matched.reference,
            }
          : null,
      }
    })
    .filter((s) => s.amount > 0)

  return NextResponse.json({
    invoices: suggestions,
    counts: {
      fetched: paid.length,
      new: suggestions.filter((s) => !s.already_imported).length,
      existing: suggestions.filter((s) => s.already_imported).length,
    },
  })
}

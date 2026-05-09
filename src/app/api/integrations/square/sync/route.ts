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
  access_token: z.string().min(10),
  environment: z.enum(["production", "sandbox"]).default("production"),
  // Optional ISO YYYY-MM-DD lower bound. Square treats it as a hint only;
  // we re-filter client-side.
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
  const body = Input.parse(await req.json())
  const host = HOSTS[body.environment]

  const headers = {
    Authorization: `Bearer ${body.access_token}`,
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

  // 4. Dedup: collect existing references and (date, amount) tuples.
  const existing = await db.execute(sql`
    select id, date, amount, reference, description from transactions
  `)
  const existingByRef = new Map<string, number>()
  const existingByKey = new Map<string, number>()
  for (const r of existing.rows as Array<{
    id: string | number
    date: string
    amount: string
    reference: string | null
    description: string
  }>) {
    if (r.reference) {
      const m = r.reference.match(/Square invoice (\S+)/i)
      if (m) existingByRef.set(m[1], Number(r.id))
    }
    const amt = Number(r.amount).toFixed(2)
    existingByKey.set(`${r.date}|${amt}`, Number(r.id))
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
      const amtKey = `${paidAt}|${amount.toFixed(2)}`
      const already =
        existingByRef.has(inv.id) || existingByKey.has(amtKey)
      return {
        square_id: inv.id,
        invoice_number: inv.invoice_number,
        title,
        description: desc,
        amount,
        paid_at: paidAt,
        customer,
        already_imported: already,
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

import { NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { sql, eq } from "drizzle-orm"
import { db, receipts } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const Input = z.object({
  image_url: z.string().url(),
  filename: z.string().optional(),
  receipt_id: z.coerce.number().optional(),
})

function buildSystem(
  cashAccounts: Array<{ id: number; code: string | null; name: string }>,
  expenseAccounts: Array<{ id: number; code: string | null; name: string }>,
) {
  const fmt = (rows: typeof cashAccounts) =>
    rows.map((r) => `- id=${r.id} | ${r.code ?? "—"} ${r.name}`).join("\n") || "(none)"

  return `You extract structured data from receipt images for a bookkeeping app and pick the best-fitting account + category.

ALWAYS return ALL fields. Make a best guess if uncertain — do not return nulls except where explicitly allowed.
Return STRICT JSON matching exactly this shape (no prose, no markdown):
{
  "description": string,            // short merchant + purpose, e.g. "Starbucks coffee"
  "reference":   string | null,     // invoice/receipt number if visible, else null
  "amount":      number,            // total paid, positive
  "date":        string,            // ISO YYYY-MM-DD; default to today if missing
  "currency":    string | null,     // 3-letter, e.g. "USD"
  "account_id":  number,            // pick the BEST cash account this came from (the bank/card account paying)
  "category_id": number,            // pick the BEST expense category for what was bought
  "reasoning_summary": string,      // ≤ 12-word headline of what you concluded
  "reasoning_steps":   string[]     // 3-5 short steps showing how you got there.
                                    // Format each step as "Title: detail" (e.g.
                                    // "Read receipt: Stripe deposit, $4,750").
}

Available cash/asset accounts (pick one for "account_id"):
${fmt(cashAccounts)}

Available expense categories (pick one for "category_id"):
${fmt(expenseAccounts)}

Use only ids that appear above. If you can't read the receipt at all, return amount: 0 with the most generic account/category ids and explain in reasoning.`
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL ?? "openrouter/owl-alpha"
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY not set" },
      { status: 503 },
    )
  }
  const body = Input.parse(await req.json())

  // Pull the live account catalog so the model can pick valid ids.
  const accountsRows = await db.execute(sql`
    select id, code, name, account_type from accounts order by account_type, code nulls last
  `)
  const allAccounts = accountsRows.rows as Array<{
    id: number
    code: string | null
    name: string
    account_type: string
  }>
  const cashAccounts = allAccounts.filter((a) => a.account_type === "asset")
  const expenseAccounts = allAccounts.filter((a) => a.account_type === "expense")
  const SYSTEM = buildSystem(cashAccounts, expenseAccounts)

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://accounting-app-vwork.vercel.app",
      "X-Title": "Accounting app - receipt analyzer",
    },
  })

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extract receipt fields. Filename hint: " +
              (body.filename ?? "(none)"),
          },
          { type: "image_url", image_url: { url: body.image_url } },
        ],
      },
    ],
  })

  const text = completion.choices[0]?.message?.content ?? "{}"
  let parsed: any = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    // Tolerate models that wrap JSON in code fences.
    const m = text.match(/\{[\s\S]*\}/)
    parsed = m ? JSON.parse(m[0]) : {}
  }

  const validAccountIds = new Set(cashAccounts.map((a) => a.id))
  const validCategoryIds = new Set(expenseAccounts.map((a) => a.id))
  const pickedAccount = Number(parsed.account_id)
  const pickedCategory = Number(parsed.category_id)

  const result = {
    description: parsed.description ?? "",
    reference: parsed.reference ?? null,
    amount: Number(parsed.amount) || 0,
    date: parsed.date ?? new Date().toISOString().slice(0, 10),
    currency: parsed.currency ?? null,
    account_id: validAccountIds.has(pickedAccount)
      ? pickedAccount
      : (cashAccounts[0]?.id ?? null),
    category_id: validCategoryIds.has(pickedCategory)
      ? pickedCategory
      : (expenseAccounts[0]?.id ?? null),
    reasoning_summary:
      typeof parsed.reasoning_summary === "string"
        ? parsed.reasoning_summary
        : typeof parsed.reasoning === "string"
          ? parsed.reasoning
          : "",
    reasoning_steps: Array.isArray(parsed.reasoning_steps)
      ? parsed.reasoning_steps.map((s: any) => String(s))
      : [],
  }

  // Persist the analysis on the receipt row so we can show "analyzed" badges
  // and the existing audit-log trigger captures the event automatically.
  if (body.receipt_id) {
    try {
      await db
        .update(receipts)
        .set({
          analyzedAt: new Date(),
          analysis: JSON.stringify(result),
          updatedAt: new Date(),
        })
        .where(eq(receipts.id, body.receipt_id))
    } catch {
      /* non-fatal — analysis result still returned to client */
    }
  }

  return NextResponse.json(result)
}

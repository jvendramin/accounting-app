import { NextResponse } from "next/server"
import OpenAI from "openai"
import { GoogleGenAI } from "@google/genai"
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
  "reasoning_steps":   string[]     // 3-5 short steps formatted "Title: detail"
}

Available cash/asset accounts (pick one for "account_id"):
${fmt(cashAccounts)}

Available expense categories (pick one for "category_id"):
${fmt(expenseAccounts)}

Use only ids that appear above. If you can't read the receipt at all, return amount: 0 with the most generic account/category ids and explain in reasoning.`
}

// Fetch the image bytes once; both providers want them in different shapes
// (Gemini = inline base64, OpenRouter = URL passthrough but we already have
// the bytes so passing them inline as a data URL is more portable).
async function fetchImage(url: string): Promise<{ data: Buffer; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`)
  const mimeType =
    res.headers.get("content-type")?.split(";")[0] || "image/jpeg"
  const buf = Buffer.from(await res.arrayBuffer())
  return { data: buf, mimeType }
}

async function analyzeWithGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userText: string,
  image: { data: Buffer; mimeType: string },
): Promise<any> {
  const ai = new GoogleGenAI({ apiKey })
  const result = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: userText },
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.data.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  })
  const text = (result as any).text ?? ""
  return JSON.parse(text)
}

async function analyzeWithOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userText: string,
  image: { data: Buffer; mimeType: string },
): Promise<any> {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://accounting-app-vwork.vercel.app",
      "X-Title": "Accounting app - receipt analyzer",
    },
  })
  const dataUrl = `data:${image.mimeType};base64,${image.data.toString("base64")}`
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  })
  const text = completion.choices[0]?.message?.content ?? "{}"
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : {}
  }
}

export async function POST(req: Request) {
  const geminiKey = process.env.GEMINI_API_KEY
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-lite"
  const orKey = process.env.OPENROUTER_API_KEY
  const orModel = process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-nano-12b-v2-vl:free"

  if (!geminiKey && !orKey) {
    return NextResponse.json(
      { error: "Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is set" },
      { status: 503 },
    )
  }
  const body = Input.parse(await req.json())

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
  const USER_TEXT =
    "Extract receipt fields. Filename hint: " + (body.filename ?? "(none)")

  const image = await fetchImage(body.image_url)

  // Try Gemini first, fall back to OpenRouter on any error.
  let parsed: any = {}
  let provider = "none"
  let lastError: any = null
  if (geminiKey) {
    try {
      parsed = await analyzeWithGemini(
        geminiKey,
        geminiModel,
        SYSTEM,
        USER_TEXT,
        image,
      )
      provider = `gemini:${geminiModel}`
    } catch (e) {
      lastError = e
    }
  }
  if (provider === "none" && orKey) {
    try {
      parsed = await analyzeWithOpenRouter(
        orKey,
        orModel,
        SYSTEM,
        USER_TEXT,
        image,
      )
      provider = `openrouter:${orModel}`
    } catch (e) {
      lastError = e
    }
  }
  if (provider === "none") {
    return NextResponse.json(
      { error: `Both providers failed: ${(lastError as any)?.message ?? "unknown"}` },
      { status: 502 },
    )
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
    provider,
  }

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
      /* non-fatal */
    }
  }

  return NextResponse.json(result)
}

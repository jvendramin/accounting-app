import { NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Input = z.object({
  image_url: z.string().url(),
  filename: z.string().optional(),
})

const SYSTEM = `You extract structured data from receipt images for a bookkeeping app.
Return STRICT JSON matching exactly this shape (no prose, no markdown):
{
  "description": string,            // short merchant + purpose, e.g. "Starbucks coffee"
  "reference":   string | null,     // invoice/receipt number if visible, else null
  "amount":      number,            // total paid, positive number
  "date":        string,            // ISO YYYY-MM-DD; if not present, today
  "currency":    string | null,     // 3-letter, e.g. "USD"
  "category_hint": string | null    // best-guess expense category, e.g. "Meals"
}
If the image isn't a receipt or you can't extract a value, use null (or 0 for amount).`

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

  return NextResponse.json({
    description: parsed.description ?? "",
    reference: parsed.reference ?? null,
    amount: Number(parsed.amount) || 0,
    date: parsed.date ?? new Date().toISOString().slice(0, 10),
    currency: parsed.currency ?? null,
    category_hint: parsed.category_hint ?? null,
  })
}

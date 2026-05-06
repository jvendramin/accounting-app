import { toast } from "sonner"

export type Account = {
  id: number
  name: string
  code?: string | null
  account_type: "asset" | "liability" | "equity" | "income" | "expense"
  description?: string | null
  balance: number
}

export type JournalLine = {
  id?: number
  account_id: number
  account_name?: string
  debit: number
  credit: number
  memo?: string | null
}

export type Txn = {
  id: number
  date: string
  description: string
  reference?: string | null
  transactionType: string
  transaction_type?: string
  amount: number
  status?: string
  journal_lines: JournalLine[]
  receipts: Array<{ id: number; filename?: string; storage_key?: string; content_type?: string }>
}

export type Receipt = {
  id: number
  filename: string
  content_type?: string
  byte_size?: number
  storage_key?: string
  url?: string | null
  transaction_id?: number | null
  uploader_sub?: string | null
  analyzed_at?: string | null
  created_at?: string
}

let lastErrorAt = 0
const showError = (msg: string) => {
  const now = Date.now()
  if (now - lastErrorAt > 4000) {
    lastErrorAt = now
    toast.error(msg, { duration: 5000 })
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    showError(`API ${res.status} on ${path}${text ? `: ${text.slice(0, 120)}` : ""}`)
    throw new Error(`HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) => {
    const qs = params
      ? "?" +
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          .join("&")
      : ""
    return request<T>("GET", path + qs)
  },
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
}

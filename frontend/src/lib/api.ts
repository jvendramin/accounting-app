import axios from "axios"
import { toast } from "sonner"

// In dev (vite serve) we want localhost. In production, fall back to a
// same-origin /api path so a missing VITE_API_URL fails *fast* (404 from
// Vercel) instead of stalling forever on a mixed-content request to
// http://localhost:3000 from an https deploy — mobile Safari hides that
// failure silently and the UI looks frozen.
const fallbackBase = import.meta.env.DEV ? "http://localhost:3000/api" : "/api"

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || fallbackBase,
  timeout: 15_000,
})

// Surface API failures with a visible toast so empty/zeroed UI states
// stop being mysterious. Uses a tiny dedupe window so a burst of failed
// requests on the same page only shows one toast.
let lastErrorAt = 0
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const now = Date.now()
    if (now - lastErrorAt > 4000) {
      lastErrorAt = now
      const status = err?.response?.status
      const url = err?.config?.url ?? ""
      const msg = status
        ? `API ${status} on ${url}`
        : `Can't reach API (${url || "unknown"}). Check VITE_API_URL.`
      toast.error(msg, { duration: 5000 })
    }
    return Promise.reject(err)
  },
)

export type Account = {
  id: number
  name: string
  code?: string
  account_type: "asset" | "liability" | "equity" | "income" | "expense"
  description?: string
  balance: number
}

export type JournalLine = {
  id?: number
  account_id: number
  account_name?: string
  debit: number
  credit: number
  memo?: string
  _destroy?: boolean
}

export type Txn = {
  id: number
  date: string
  description: string
  reference?: string
  transaction_type: "deposit" | "withdrawal" | "journal_entry" | "receipt"
  amount: number
  status?: string
  journal_lines: JournalLine[]
  receipts?: Array<{ id: number; filename: string; url?: string }>
}

import axios from "axios"

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
})

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

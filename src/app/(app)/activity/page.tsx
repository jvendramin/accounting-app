"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

type AuditRow = {
  id: number
  table_name: string
  row_id: number | null
  op: "INSERT" | "UPDATE" | "DELETE"
  changed_at: string
  changed_by: string | null
  old_data: Record<string, any> | null
  new_data: Record<string, any> | null
}

const OP_INTENT: Record<
  AuditRow["op"],
  "primary" | "success" | "warning" | "danger" | "secondary"
> = {
  INSERT: "success",
  UPDATE: "primary",
  DELETE: "danger",
}

function summarize(row: AuditRow): string {
  const data = row.new_data ?? row.old_data ?? {}
  if (row.table_name === "transactions") {
    const desc = data.description ?? "(no description)"
    const amt = data.amount != null ? ` $${Number(data.amount).toFixed(2)}` : ""
    return `${desc}${amt}`
  }
  if (row.table_name === "accounts" || row.table_name === "categories") {
    return data.name ?? `#${row.row_id}`
  }
  if (row.table_name === "journal_lines") {
    const debit = Number(data.debit ?? 0)
    const credit = Number(data.credit ?? 0)
    return `Debit $${debit.toFixed(2)} / Credit $${credit.toFixed(2)}`
  }
  if (row.table_name === "receipts") {
    const oldA = row.old_data?.analyzed_at
    const newA = row.new_data?.analyzed_at
    if (newA && newA !== oldA) return `Analyzed: ${data.filename ?? `#${row.row_id}`}`
    return data.filename ?? `#${row.row_id}`
  }
  return `#${row.row_id ?? "?"}`
}

const niceTime = (iso: string) => {
  const d = new Date(iso)
  const now = Date.now()
  const diffSec = Math.round((now - d.getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function ActivityPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    api
      .get<AuditRow[]>("/api/audit", { limit: 500 })
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader>
        <CardTitle>Activity log</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto px-4 py-4">
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-fg">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-fg">
            No activity yet.
          </div>
        ) : (
          <ol className="grid gap-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border bg-bg/40 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <Badge intent={OP_INTENT[r.op]}>{r.op}</Badge>
                  <span className="text-xs text-muted-fg font-mono">
                    {r.table_name}
                  </span>
                  <span className="ml-auto text-xs text-muted-fg whitespace-nowrap">
                    {niceTime(r.changed_at)}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm">{summarize(r)}</div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

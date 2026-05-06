"use client"

import { useEffect, useState } from "react"
import {
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

export function ActivityLogSheet({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    api
      .get<AuditRow[]>("/api/audit", { limit: 200 })
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen])

  return (
    <SheetContent
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      side="right"
      className="sm:max-w-md"
    >
      <SheetHeader>
        <SheetTitle>Activity log</SheetTitle>
      </SheetHeader>
      <SheetBody>
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
      </SheetBody>
    </SheetContent>
  )
}

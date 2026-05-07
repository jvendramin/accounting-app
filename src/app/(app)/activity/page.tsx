"use client"

import { useEffect, useMemo, useState } from "react"
import { TableBody } from "react-aria-components"
import {
  Table,
  TableCell,
  TableColumn,
  TableHeader as IntentTableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SearchField, SearchInput } from "@/components/ui/search-field"
import {
  ComboBox,
  ComboBoxContent,
  ComboBoxInput,
  ComboBoxItem,
} from "@/components/ui/combo-box"
import {
  DateRangePicker,
  DateRangePickerTrigger,
} from "@/components/ui/date-range-picker"
import { parseDate } from "@internationalized/date"
import { IconX } from "@/components/icons"
import { titleCase } from "@/lib/format"
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

type SortDesc = { column: string; direction: "ascending" | "descending" }

const OPS = ["INSERT", "UPDATE", "DELETE"] as const

export default function ActivityPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [op, setOp] = useState<string>("all")
  const [tableName, setTableName] = useState<string>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [sortDescriptor, setSortDescriptor] = useState<SortDesc>({
    column: "changed_at",
    direction: "descending",
  })

  useEffect(() => {
    setLoading(true)
    api
      .get<AuditRow[]>("/api/audit", { limit: 500 })
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const tableNames = useMemo(
    () => Array.from(new Set(rows.map((r) => r.table_name))).sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (op !== "all" && r.op !== op) return false
      if (tableName !== "all" && r.table_name !== tableName) return false
      if (from) {
        const t = new Date(r.changed_at).getTime()
        if (t < new Date(from).getTime()) return false
      }
      if (to) {
        const t = new Date(r.changed_at).getTime()
        if (t > new Date(to).getTime() + 86_400_000) return false
      }
      if (!ql) return true
      const hay =
        `${r.op} ${r.table_name} ${summarize(r)} ${r.changed_by ?? ""}`.toLowerCase()
      return hay.includes(ql)
    })
  }, [rows, q, op, tableName, from, to])

  const sorted = useMemo(() => {
    const { column, direction } = sortDescriptor
    return [...filtered].sort((a, b) => {
      const av: any =
        column === "summary"
          ? summarize(a)
          : column === "when"
            ? a.changed_at
            : (a as any)[column] ?? ""
      const bv: any =
        column === "summary"
          ? summarize(b)
          : column === "when"
            ? b.changed_at
            : (b as any)[column] ?? ""
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv))
      return direction === "descending" ? -cmp : cmp
    })
  }, [filtered, sortDescriptor])

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2 sm:contents">
          <CardTitle>Activity log</CardTitle>
          <div className="flex items-center gap-2 sm:hidden">
            <Button
              intent="outline"
              size="sm"
              onPress={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
            >
              {showFilters ? "Hide" : "Filters"}
            </Button>
          </div>
        </div>
        <div
          className={
            "flex flex-wrap items-center gap-2.5 w-full sm:w-auto " +
            (showFilters ? "flex" : "hidden sm:flex")
          }
        >
          <SearchField
            aria-label="Search"
            value={q}
            onChange={setQ}
            className="w-full sm:w-56"
          >
            <SearchInput placeholder="Search..." />
          </SearchField>
          <ComboBox
            aria-label="Op"
            selectedKey={op}
            onSelectionChange={(k) => setOp(k == null ? "all" : String(k))}
            className="w-full sm:w-[140px]"
          >
            <ComboBoxInput placeholder="All ops" />
            <ComboBoxContent>
              <ComboBoxItem id="all">All ops</ComboBoxItem>
              {OPS.map((o) => (
                <ComboBoxItem key={o} id={o}>
                  {titleCase(o)}
                </ComboBoxItem>
              ))}
            </ComboBoxContent>
          </ComboBox>
          <ComboBox
            aria-label="Table"
            selectedKey={tableName}
            onSelectionChange={(k) =>
              setTableName(k == null ? "all" : String(k))
            }
            className="w-full sm:w-[160px]"
          >
            <ComboBoxInput placeholder="All tables" />
            <ComboBoxContent>
              <ComboBoxItem id="all">All tables</ComboBoxItem>
              {tableNames.map((n) => (
                <ComboBoxItem key={n} id={n}>
                  {n}
                </ComboBoxItem>
              ))}
            </ComboBoxContent>
          </ComboBox>
          <div className="flex w-full items-center gap-1 sm:w-auto">
            <DateRangePicker
              aria-label="Date range"
              className="w-full sm:w-[280px]"
              value={
                from && to
                  ? { start: parseDate(from), end: parseDate(to) }
                  : null
              }
              onChange={(v) => {
                setFrom(v ? v.start.toString() : "")
                setTo(v ? v.end.toString() : "")
              }}
            >
              <DateRangePickerTrigger />
            </DateRangePicker>
            {(from || to) && (
              <Button
                intent="plain"
                size="sq-sm"
                aria-label="Clear date range"
                onPress={() => {
                  setFrom("")
                  setTo("")
                }}
              >
                <IconX />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent
        className="flex-1 overflow-auto px-4 py-0 [&_table]:min-w-[720px]"
        style={{ "--gutter": "1rem" } as React.CSSProperties}
      >
        <Table
          allowResize
          aria-label="Activity log"
          sortDescriptor={sortDescriptor}
          onSortChange={(d) => setSortDescriptor(d as SortDesc)}
        >
          <IntentTableHeader>
            <TableColumn id="when" isRowHeader allowsSorting>
              When
            </TableColumn>
            <TableColumn id="op" allowsSorting>
              Op
            </TableColumn>
            <TableColumn id="table_name" allowsSorting isResizable>
              Table
            </TableColumn>
            <TableColumn
              id="summary"
              allowsSorting
              isResizable
              className="w-full"
            >
              Summary
            </TableColumn>
            <TableColumn id="changed_by" isResizable>
              By
            </TableColumn>
          </IntentTableHeader>
          <TableBody
            items={sorted}
            renderEmptyState={() => (
              <div className="p-8 text-center text-sm text-muted-fg">
                {loading ? "Loading…" : "No activity."}
              </div>
            )}
          >
            {(r) => (
              <TableRow id={r.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-fg">
                  {niceTime(r.changed_at)}
                </TableCell>
                <TableCell>
                  <Badge intent={OP_INTENT[r.op]}>{r.op}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.table_name}
                </TableCell>
                <TableCell className="font-medium">{summarize(r)}</TableCell>
                <TableCell className="text-xs text-muted-fg">
                  {r.changed_by ?? "—"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

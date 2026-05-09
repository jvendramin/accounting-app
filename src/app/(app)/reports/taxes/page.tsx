"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { TableBody } from "react-aria-components"
import {
  Table,
  TableCell,
  TableColumn,
  TableHeader as IntentTableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import {
  DateRangePicker,
  DateRangePickerTrigger,
} from "@/components/ui/date-range-picker"
import { parseDate } from "@internationalized/date"
import { useCachedFetch } from "@/hooks/use-cached-fetch"
import { api } from "@/lib/api"
import { fmtMoney, titleCase } from "@/lib/format"
import { ReportExportMenu } from "@/components/report-export-menu"

type TaxTotal = {
  tax_id: number
  tax_name: string
  rate: number
  collected: number
  net: number
  count: number
}

type TaxDetail = {
  transaction_id: number
  tax_id: number
  tax_name: string
  rate: number
  tax_amount: number
  net_amount: number
  date: string
  description: string
  transaction_type: "deposit" | "withdrawal" | "journal_entry" | string
  amount: number
}

type TaxReport = {
  totals: TaxTotal[]
  details: TaxDetail[]
}

const TYPE_INTENT: Record<
  string,
  "primary" | "secondary" | "warning" | "danger" | "success" | "info"
> = {
  deposit: "success",
  withdrawal: "danger",
  journal_entry: "info",
}

export default function ReportsTaxesPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  // Drill-down filter: when a totals row is clicked we narrow the
  // detail table to that single tax. null = show every tax.
  const [drillTaxId, setDrillTaxId] = useState<number | null>(null)
  const { data } = useCachedFetch<TaxReport>(
    `reports/taxes:from=${from}|to=${to}`,
    () =>
      api.get("/api/reports/taxes", {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
  )
  const totals = data?.totals ?? []
  const details = data?.details ?? []

  const filteredDetails = useMemo(
    () =>
      drillTaxId == null
        ? details
        : details.filter((d) => d.tax_id === drillTaxId),
    [details, drillTaxId],
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card>
        <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <CardTitle>Tax report</CardTitle>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-end">
            <ReportExportMenu
              filename={`tax-report${from && to ? `_${from}_${to}` : ""}`}
              getRows={() => ({
                Totals: totals.map((t) => ({
                  tax: t.tax_name,
                  rate: Number(t.rate),
                  txns: t.count,
                  net: Number(t.net),
                  collected: Number(t.collected),
                })),
                Details: filteredDetails.map((d) => ({
                  date: d.date,
                  description: d.description,
                  type: d.transaction_type,
                  tax: d.tax_name,
                  rate: Number(d.rate),
                  net: Number(d.net_amount),
                  tax_amount: Number(d.tax_amount),
                  gross: Number(d.amount),
                })),
              })}
            />
            <DateRangePicker
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
              <Label>Period</Label>
              <DateRangePickerTrigger />
            </DateRangePicker>
          </div>
        </CardHeader>
        <CardContent
          className="px-4 py-0 [&_table]:min-w-[640px]"
          style={{ "--gutter": "1rem" } as React.CSSProperties}
        >
          <Table
            aria-label="Tax totals"
            selectionMode="single"
            selectedKeys={drillTaxId == null ? [] : [String(drillTaxId)]}
            onSelectionChange={(keys) => {
              if (keys === "all") return
              const first = Array.from(keys)[0]
              setDrillTaxId(first == null ? null : Number(first))
            }}
          >
            <IntentTableHeader>
              <TableColumn id="name" isRowHeader className="w-full">
                Tax
              </TableColumn>
              <TableColumn id="rate">Rate</TableColumn>
              <TableColumn id="count">Txns</TableColumn>
              <TableColumn id="net">Net</TableColumn>
              <TableColumn id="collected">Collected</TableColumn>
            </IntentTableHeader>
            <TableBody
              items={totals.map((t) => ({ ...t, id: t.tax_id }))}
              renderEmptyState={() => (
                <div className="p-8 text-center text-sm text-muted-fg">
                  No tax activity in this period.
                </div>
              )}
            >
              {(t: any) => (
                <TableRow id={String(t.tax_id)}>
                  <TableCell className="font-medium">{t.tax_name}</TableCell>
                  <TableCell className="tabular-nums">
                    {(Number(t.rate) * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="tabular-nums">{t.count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(Number(t.net))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {fmtMoney(Number(t.collected))}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="flex flex-1 min-h-0 flex-col">
        <CardHeader className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Contributing transactions</CardTitle>
            <p className="mt-1 text-xs text-muted-fg">
              {drillTaxId == null
                ? "Every transaction with tax recorded in the selected period."
                : `Showing only ${
                    totals.find((t) => t.tax_id === drillTaxId)?.tax_name ??
                    "selected tax"
                  }. Click the row above again to clear.`}
            </p>
          </div>
        </CardHeader>
        <CardContent
          className="flex-1 overflow-auto px-4 py-0 [&_table]:min-w-[720px]"
          style={{ "--gutter": "1rem" } as React.CSSProperties}
        >
          <Table aria-label="Contributing transactions">
            <IntentTableHeader>
              <TableColumn id="date">Date</TableColumn>
              <TableColumn id="description" isRowHeader className="w-full">
                Description
              </TableColumn>
              <TableColumn id="type">Type</TableColumn>
              <TableColumn id="tax">Tax</TableColumn>
              <TableColumn id="net">Net</TableColumn>
              <TableColumn id="amount">Tax amount</TableColumn>
              <TableColumn id="gross">Gross</TableColumn>
            </IntentTableHeader>
            <TableBody
              items={filteredDetails.map((d, i) => ({
                ...d,
                id: `${d.transaction_id}-${d.tax_id}-${i}`,
              }))}
              renderEmptyState={() => (
                <div className="p-8 text-center text-sm text-muted-fg">
                  No contributing transactions.
                </div>
              )}
            >
              {(d: any) => (
                <TableRow id={d.id}>
                  <TableCell className="tabular-nums whitespace-nowrap">
                    {d.date}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/transactions?focus=${d.transaction_id}`}
                      className="hover:underline"
                    >
                      {d.description}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      intent={
                        TYPE_INTENT[d.transaction_type] ?? "secondary"
                      }
                    >
                      {titleCase(
                        String(d.transaction_type).replace("_", " "),
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {d.tax_name}{" "}
                    <span className="text-muted-fg">
                      {(Number(d.rate) * 100).toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(Number(d.net_amount))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {fmtMoney(Number(d.tax_amount))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(Number(d.amount))}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

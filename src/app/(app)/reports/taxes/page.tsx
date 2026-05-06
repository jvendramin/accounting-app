"use client"

import { useState } from "react"
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
import {
  DateRangePicker,
  DateRangePickerTrigger,
} from "@/components/ui/date-range-picker"
import { parseDate } from "@internationalized/date"
import { useCachedFetch } from "@/hooks/use-cached-fetch"
import { api } from "@/lib/api"
import { fmtMoney } from "@/lib/format"

type TaxTotal = {
  tax_id: number
  tax_name: string
  rate: number
  collected: number
  net: number
  count: number
}

type TaxReport = { totals: TaxTotal[] }

export default function ReportsTaxesPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const { data } = useCachedFetch<TaxReport>(
    `reports/taxes:from=${from}|to=${to}`,
    () =>
      api.get("/api/reports/taxes", {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
  )
  const totals = data?.totals ?? []

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <CardTitle>Tax report</CardTitle>
        <div className="w-full sm:w-auto">
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
        className="flex-1 overflow-auto px-4 py-0 [&_table]:min-w-[640px]"
        style={{ "--gutter": "1rem" } as React.CSSProperties}
      >
        <Table aria-label="Tax totals">
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
              <TableRow id={t.tax_id}>
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
  )
}

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
import { ReportExportMenu } from "@/components/report-export-menu"

type Cash = {
  monthly: Array<{ month: string; inflow: number; outflow: number; net: number }>
}

export default function ReportsCashflowPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const { data } = useCachedFetch<Cash>(
    `reports/cashflow:from=${from}|to=${to}`,
    () =>
      api.get("/api/reports/cashflow", {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
  )
  const rows = data?.monthly ?? []

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <CardTitle>Cashflow</CardTitle>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-end">
          <ReportExportMenu
            filename={`cashflow${from && to ? `_${from}_${to}` : ""}`}
            getRows={() => ({
              Monthly: rows.map((r) => ({
                month: r.month,
                inflow: r.inflow,
                outflow: r.outflow,
                net: r.net,
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
      <CardContent className="flex-1 overflow-auto p-0">
        <Table aria-label="Cashflow">
          <IntentTableHeader>
            <TableColumn id="month" isRowHeader>Month</TableColumn>
            <TableColumn id="in">Inflow</TableColumn>
            <TableColumn id="out">Outflow</TableColumn>
            <TableColumn id="net">Net</TableColumn>
          </IntentTableHeader>
          <TableBody
            items={rows.map((r) => ({ ...r, id: r.month }))}
            renderEmptyState={() => (
              <div className="p-8 text-center text-sm text-muted-fg">No data</div>
            )}
          >
            {(r: any) => (
              <TableRow id={r.month}>
                <TableCell className="font-mono text-xs">{r.month}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMoney(r.inflow)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMoney(r.outflow)}
                </TableCell>
                <TableCell
                  className={
                    "text-right tabular-nums " +
                    (r.net >= 0 ? "text-emerald-500" : "text-danger")
                  }
                >
                  {fmtMoney(r.net)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

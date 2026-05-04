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

type PnL = {
  total_income: number
  total_expense: number
  net_income: number
  monthly: Array<{ month: string; income: number; expense: number; net: number }>
}

export default function ReportsPnLPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const key = `reports/pnl:from=${from}|to=${to}`
  const { data } = useCachedFetch<PnL>(key, () =>
    api.get("/api/reports/profit_and_loss", {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
  )
  const rows = data?.monthly ?? []

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <CardTitle>Profit &amp; Loss</CardTitle>
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
      <CardContent className="flex-1 overflow-auto p-0">
        <Table aria-label="Profit and Loss">
          <IntentTableHeader>
            <TableColumn id="month" isRowHeader>Month</TableColumn>
            <TableColumn id="income">Income</TableColumn>
            <TableColumn id="expense">Expense</TableColumn>
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
                  {fmtMoney(r.income)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMoney(r.expense)}
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
        <div className="border-t p-4 text-sm">
          <div className="ml-auto grid max-w-sm grid-cols-2 gap-x-8 gap-y-1">
            <div className="text-muted-fg">Total income</div>
            <div className="text-right tabular-nums">
              {fmtMoney(data?.total_income ?? 0)}
            </div>
            <div className="text-muted-fg">Total expense</div>
            <div className="text-right tabular-nums">
              {fmtMoney(data?.total_expense ?? 0)}
            </div>
            <div className="font-semibold">Net income</div>
            <div className="text-right tabular-nums font-semibold">
              {fmtMoney(data?.net_income ?? 0)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

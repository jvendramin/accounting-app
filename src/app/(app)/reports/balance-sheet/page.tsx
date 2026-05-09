"use client"

import { useState, useMemo } from "react"
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
import { DatePicker, DatePickerTrigger } from "@/components/ui/date-picker"
import { parseDate } from "@internationalized/date"
import { useCachedFetch } from "@/hooks/use-cached-fetch"
import { api } from "@/lib/api"
import { fmtMoney, titleCase } from "@/lib/format"
import { ReportExportMenu } from "@/components/report-export-menu"

type BS = {
  accounts: Array<{
    id: number
    name: string
    code?: string
    account_type: string
    balance: number
  }>
}

export default function ReportsBalanceSheetPage() {
  const [asOf, setAsOf] = useState("")
  const { data } = useCachedFetch<BS>(`reports/bs:as_of=${asOf}`, () =>
    api.get("/api/reports/balance_sheet", { ...(asOf ? { as_of: asOf } : {}) }),
  )
  const rows = data?.accounts ?? []

  const totals = useMemo(() => {
    const t = { asset: 0, liability: 0, equity: 0 }
    for (const r of rows) {
      if (r.account_type in t) (t as any)[r.account_type] += r.balance
    }
    return t
  }, [rows])

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <CardTitle>Balance Sheet</CardTitle>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-end">
          <ReportExportMenu
            filename={`balance-sheet${asOf ? `_${asOf}` : ""}`}
            getRows={() => ({
              Accounts: rows.map((a) => ({
                code: a.code ?? "",
                name: a.name,
                type: a.account_type,
                balance: a.balance,
              })),
              Totals: [
                {
                  total_assets: totals.asset,
                  total_liabilities: totals.liability,
                  total_equity: totals.equity,
                  liabilities_plus_equity: totals.liability + totals.equity,
                },
              ],
            })}
          />
          <DatePicker
            value={asOf ? parseDate(asOf) : null}
            onChange={(d) => setAsOf(d ? d.toString() : "")}
          >
            <Label>As of</Label>
            <DatePickerTrigger />
          </DatePicker>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        <Table aria-label="Balance sheet">
          <IntentTableHeader>
            <TableColumn id="code" isRowHeader>Code</TableColumn>
            <TableColumn id="name">Name</TableColumn>
            <TableColumn id="type">Type</TableColumn>
            <TableColumn id="bal">Balance</TableColumn>
          </IntentTableHeader>
          <TableBody
            items={rows}
            renderEmptyState={() => (
              <div className="p-8 text-center text-sm text-muted-fg">No data</div>
            )}
          >
            {(a) => (
              <TableRow id={a.id}>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell>{titleCase(a.account_type)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMoney(a.balance)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="border-t p-4 text-sm">
          <div className="ml-auto grid max-w-sm grid-cols-2 gap-x-8 gap-y-1">
            <div className="text-muted-fg">Total assets</div>
            <div className="text-right tabular-nums">{fmtMoney(totals.asset)}</div>
            <div className="text-muted-fg">Total liabilities</div>
            <div className="text-right tabular-nums">{fmtMoney(totals.liability)}</div>
            <div className="text-muted-fg">Total equity</div>
            <div className="text-right tabular-nums">{fmtMoney(totals.equity)}</div>
            <div className="font-semibold">L + E</div>
            <div className="text-right tabular-nums font-semibold">
              {fmtMoney(totals.liability + totals.equity)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

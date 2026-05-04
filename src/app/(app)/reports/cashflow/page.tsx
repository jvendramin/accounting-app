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
import { TextField } from "@/components/ui/text-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/field"
import { useCachedFetch } from "@/hooks/use-cached-fetch"
import { api } from "@/lib/api"
import { fmtMoney } from "@/lib/format"

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
        <div className="flex flex-wrap items-end gap-2.5 w-full sm:w-auto">
          <TextField value={from} onChange={setFrom} className="w-40">
            <Label>From</Label>
            <Input type="date" />
          </TextField>
          <TextField value={to} onChange={setTo} className="w-40">
            <Label>To</Label>
            <Input type="date" />
          </TextField>
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

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table"
import { api } from "@/lib/api"
import { withMinDelay } from "@/lib/loading"
import { fmtMoney } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DataGrid,
  DataGridTable,
  DataGridScrollArea,
  DataGridPagination,
} from "@/components/reui/data-grid"
import {
  Frame, FramePanel, FrameHeader, FrameTitle, FrameFooter,
} from "@/components/reui/frame"
import {
  type DateSelectorValue,
} from "@/components/reui/date-selector"
import { DateSelectorPopover } from "@/components/date-selector-popover"

type LineItem = { name: string; amount: number }

type PnL = {
  income: LineItem[]
  expense: LineItem[]
  total_income: number; total_expense: number; net_income: number
  monthly: { month: string; income: number; expense: number; net: number }[]
}

function LineItemSection({
  title,
  rows,
  total,
  totalLabel,
  loading,
  rangeControl,
}: {
  title: string
  rows: LineItem[]
  total: number
  totalLabel: string
  loading: boolean
  rangeControl?: React.ReactNode
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })

  const columns = useMemo<ColumnDef<LineItem>[]>(() => [
    { accessorKey: "name", header: "Account" },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => <div className="text-right tabular-nums">{fmtMoney(row.original.amount)}</div>,
    },
  ], [])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => r.name,
    state: { pagination },
    onPaginationChange: setPagination,
  })

  const footer = !loading ? (
    <tr className="bg-muted/40 font-medium">
      <td className="px-4 py-2">{totalLabel}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(total)}</td>
    </tr>
  ) : null

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      isLoading={loading && rows.length === 0}
      loadingMode="skeleton"
      tableLayout={{
        columnsPinnable: true,
        columnsResizable: false,
        columnsMovable: true,
        columnsVisibility: true,
      }}
    >
      <Frame className="w-full" stacked dense>
        <FrameHeader className="flex w-full flex-row flex-wrap items-center justify-between gap-3">
          <FrameTitle>{title}</FrameTitle>
          {rangeControl && <div className="flex items-center gap-2.5">{rangeControl}</div>}
        </FrameHeader>
        <FramePanel className="p-0 shadow-none">
          <DataGridScrollArea>
            <DataGridTable footerContent={footer} />
          </DataGridScrollArea>
        </FramePanel>
        <FrameFooter className="py-1.5 pr-2 pl-2.5">
          <DataGridPagination />
        </FrameFooter>
      </Frame>
    </DataGrid>
  )
}

export default function ReportsPnL() {
  const [data, setData] = useState<PnL | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [rangeValue, setRangeValue] = useState<DateSelectorValue | undefined>()

  useEffect(() => {
    setLoading(true)
    withMinDelay(api.get("/reports/profit_and_loss", { params: { from, to } }), 1000)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [from, to])

  const handleRangeChange = (v: DateSelectorValue | undefined) => {
    setRangeValue(v)
    setFrom(v?.startDate ? format(v.startDate, "yyyy-MM-dd") : "")
    setTo(v?.endDate ? format(v.endDate, "yyyy-MM-dd") : "")
  }

  const rangeControl = (
    <DateSelectorPopover
      value={rangeValue}
      onChange={handleRangeChange}
      allowRange
      defaultFilterType="between"
      periodTypes={["day"]}
    />
  )

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle>Monthly</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-[300px] w-full" /> : (
            <ChartContainer
              config={{
                income: { label: "Income", color: "var(--chart-1)" },
                expense: { label: "Expense", color: "var(--chart-2)" },
              }}
              className="h-[300px] w-full"
            >
              <BarChart data={data?.monthly ?? []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={4} />
                <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <LineItemSection
        title="Profit & Loss — Income"
        rows={data?.income ?? []}
        total={data?.total_income ?? 0}
        totalLabel="Total Income"
        loading={loading}
        rangeControl={rangeControl}
      />
      <LineItemSection
        title="Profit & Loss — Expenses"
        rows={data?.expense ?? []}
        total={data?.total_expense ?? 0}
        totalLabel="Total Expense"
        loading={loading}
      />

      <Card>
        <CardHeader><CardTitle>Net Income</CardTitle></CardHeader>
        <CardContent className="text-3xl font-semibold">
          {loading ? <Skeleton className="h-8 w-40" /> : fmtMoney(data?.net_income ?? 0)}
        </CardContent>
      </Card>
    </div>
  )
}

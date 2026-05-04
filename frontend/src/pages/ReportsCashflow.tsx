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
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
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

type Row = { month: string; inflow: number; outflow: number; net: number }

export default function ReportsCashflow() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [rangeValue, setRangeValue] = useState<DateSelectorValue | undefined>()
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })

  useEffect(() => {
    setLoading(true)
    withMinDelay(api.get("/reports/cashflow", { params: { from, to } }), 1000)
      .then((r) => setRows(r.data.monthly))
      .finally(() => setLoading(false))
  }, [from, to])

  const handleRangeChange = (v: DateSelectorValue | undefined) => {
    setRangeValue(v)
    setFrom(v?.startDate ? format(v.startDate, "yyyy-MM-dd") : "")
    setTo(v?.endDate ? format(v.endDate, "yyyy-MM-dd") : "")
  }

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: "month", header: "Month" },
    {
      accessorKey: "inflow",
      header: () => <div className="text-right">Inflow</div>,
      cell: ({ row }) => <div className="text-right tabular-nums">{fmtMoney(row.original.inflow)}</div>,
    },
    {
      accessorKey: "outflow",
      header: () => <div className="text-right">Outflow</div>,
      cell: ({ row }) => <div className="text-right tabular-nums">{fmtMoney(row.original.outflow)}</div>,
    },
    {
      accessorKey: "net",
      header: () => <div className="text-right">Net</div>,
      cell: ({ row }) => <div className="text-right tabular-nums">{fmtMoney(row.original.net)}</div>,
    },
  ], [])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => r.month,
    state: { pagination },
    onPaginationChange: setPagination,
  })

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle>Cash Inflow vs Outflow</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-[320px] w-full" /> : (
            <ChartContainer
              config={{
                inflow: { label: "Inflow", color: "var(--chart-1)" },
                outflow: { label: "Outflow", color: "var(--chart-2)" },
              }}
              className="h-[320px] w-full"
            >
              <AreaChart data={rows}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="inflow" type="monotone" fill="var(--color-inflow)" stroke="var(--color-inflow)" fillOpacity={0.3} />
                <Area dataKey="outflow" type="monotone" fill="var(--color-outflow)" stroke="var(--color-outflow)" fillOpacity={0.3} />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

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
          <FrameHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <FrameTitle>Cash Flow</FrameTitle>
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <DateSelectorPopover
                value={rangeValue}
                onChange={handleRangeChange}
                allowRange
                defaultFilterType="between"
                periodTypes={["day"]}
              />
            </div>
          </FrameHeader>
          <FramePanel className="p-0 shadow-none">
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </FramePanel>
          <FrameFooter className="py-1.5 pr-2 pl-2.5">
            <DataGridPagination />
          </FrameFooter>
        </Frame>
      </DataGrid>
    </div>
  )
}

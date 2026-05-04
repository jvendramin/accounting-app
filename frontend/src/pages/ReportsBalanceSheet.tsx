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
import { Label } from "@/components/ui/label"
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

type Row = { account_id: number; name: string; amount: number }
type BS = {
  assets: Row[]; liabilities: Row[]; equity: Row[]
  total_assets: number; total_liabilities: number; total_equity: number
}

function Section({
  title, rows, total, loading, asOfControl,
}: {
  title: string
  rows: Row[]
  total: number
  loading: boolean
  asOfControl?: React.ReactNode
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })

  const columns = useMemo<ColumnDef<Row>[]>(() => [
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
    getRowId: (r) => String(r.account_id),
    state: { pagination },
    onPaginationChange: setPagination,
  })

  const footer = !loading ? (
    <tr className="bg-muted/40 font-medium">
      <td className="px-4 py-2">Total</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(total)}</td>
    </tr>
  ) : null

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      isLoading={loading && rows.length === 0}
      loadingMode="skeleton"
      emptyMessage="No balances"
      tableLayout={{
        columnsPinnable: true,
        columnsResizable: false,
        columnsMovable: true,
        columnsVisibility: true,
      }}
    >
      <Frame className="w-full" stacked dense>
        <FrameHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <FrameTitle>{title}</FrameTitle>
          {asOfControl && <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">{asOfControl}</div>}
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

export default function ReportsBalanceSheet() {
  const [data, setData] = useState<BS | null>(null)
  const [loading, setLoading] = useState(true)
  const [asOf, setAsOf] = useState("")
  const [asOfValue, setAsOfValue] = useState<DateSelectorValue | undefined>()

  useEffect(() => {
    setLoading(true)
    withMinDelay(api.get("/reports/balance_sheet", { params: { as_of: asOf } }), 1000)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [asOf])

  const handleDateChange = (v: DateSelectorValue | undefined) => {
    setAsOfValue(v)
    setAsOf(v?.startDate ? format(v.startDate, "yyyy-MM-dd") : "")
  }

  const asOfControl = (
    <>
      <Label className="text-xs text-muted-foreground">As of</Label>
      <DateSelectorPopover
        value={asOfValue}
        onChange={handleDateChange}
        presetMode="is"
        periodTypes={["day"]}
      />
    </>
  )

  return (
    <div className="grid gap-4">
      <Section
        title="Balance Sheet — Assets"
        rows={data?.assets ?? []}
        total={data?.total_assets ?? 0}
        loading={loading}
        asOfControl={asOfControl}
      />
      <Section
        title="Balance Sheet — Liabilities"
        rows={data?.liabilities ?? []}
        total={data?.total_liabilities ?? 0}
        loading={loading}
      />
      <Section
        title="Balance Sheet — Equity"
        rows={data?.equity ?? []}
        total={data?.total_equity ?? 0}
        loading={loading}
      />
    </div>
  )
}

import { useEffect, useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type PaginationState,
  type Row,
  type RowSelectionState,
} from "@tanstack/react-table"
import { api, type Account } from "@/lib/api"
import { fmtMoney, titleCase } from "@/lib/format"
import { invalidateCache, useCachedFetch } from "@/hooks/use-cached-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuGroup, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useAutoFitPageSize } from "@/hooks/use-auto-fit-page-size"
import {
  InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton,
} from "@/components/ui/input-group"
import { Trash2, Plus, SearchIcon, XIcon, MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"
import {
  DataGrid,
  DataGridTable,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
  DataGridScrollArea,
  DataGridPagination,
} from "@/components/reui/data-grid"
import {
  Frame, FramePanel, FrameHeader, FrameTitle, FrameFooter,
} from "@/components/reui/frame"

function ActionsCell<T extends { id: number | string }>({
  row, onEdit, onDelete,
}: { row: Row<T>; onEdit: (r: T) => void; onDelete: (id: T["id"]) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="size-7" size="icon" variant="ghost"><MoreHorizontalIcon /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onEdit(row.original)}>
            <PencilIcon /> Edit
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original.id)}>
            <TrashIcon /> Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const TYPES = ["asset", "liability", "equity", "income", "expense"] as const

export default function Accounts() {
  const [editing, setEditing] = useState<Partial<Account> | null>(null)
  const [open, setOpen] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const [q, setQ] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const { ref: panelRef } = useAutoFitPageSize(44, 40)

  const { data: rowsData, loading: rowsLoading, refetch: load } =
    useCachedFetch<Account[]>(
      "accounts:all",
      () => api.get("/accounts").then((r) => r.data as Account[]),
    )
  const rows = useMemo(() => rowsData ?? [], [rowsData])
  // Skeleton only on initial load (no cache yet); revalidation is silent.
  const loading = rowsLoading && rowsData === undefined

  const save = async () => {
    if (!editing?.name || !editing?.account_type) {
      toast.error("Name and type are required"); return
    }
    const wasUpdate = !!editing.id
    try {
      if (editing.id) await api.put(`/accounts/${editing.id}`, { account: editing })
      else await api.post("/accounts", { account: editing })
      setOpen(false); setEditing(null); invalidateCache("accounts:all"); load()
      toast.success(wasUpdate ? "Account updated" : "Account created")
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this account?")) return
    try {
      await api.delete(`/accounts/${id}`)
      invalidateCache("accounts:all"); load()
      toast.error("Account deleted")
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  const columns = useMemo<ColumnDef<Account>[]>(() => [
    {
      id: "select",
      header: () => <DataGridTableRowSelectAll />,
      cell: ({ row }) => <DataGridTableRowSelect row={row} />,
      enableSorting: false,
      enableResizing: false,
      size: 35,
    },
    {
      accessorKey: "code",
      header: "Code",
      size: 96,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "account_type",
      header: "Type",
      cell: ({ row }) => <Badge variant="secondary">{titleCase(row.original.account_type)}</Badge>,
    },
    {
      accessorKey: "balance",
      header: () => <div className="text-right">Balance</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{fmtMoney(row.original.balance)}</div>
      ),
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "actions",
      header: "",
      size: 60,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ActionsCell
            row={row}
            onEdit={(r) => { setEditing(r); setOpen(true) }}
            onDelete={(id) => remove(id as number)}
          />
        </div>
      ),
      enableSorting: false,
    },
  ], [])

  const filteredRows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.account_type !== typeFilter) return false
      if (!ql) return true
      return (
        (r.name ?? "").toLowerCase().includes(ql) ||
        (r.code ?? "").toLowerCase().includes(ql)
      )
    })
  }, [rows, q, typeFilter])

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => String(r.id),
    enableRowSelection: true,
    state: { rowSelection, pagination },
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
  })

  const selectedIds = table.getSelectedRowModel().rows.map((r) => r.original.id)
  const selectedCount = selectedIds.length

  const bulkDelete = async () => {
    if (selectedCount === 0) return
    if (!confirm(`Delete ${selectedCount} account(s)?`)) return
    const n = selectedCount
    try {
      await api.post("/accounts/bulk_destroy", { ids: selectedIds })
      setRowSelection({}); invalidateCache("accounts:all"); load()
      toast.error(`${n} account${n === 1 ? "" : "s"} deleted`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input value={editing?.code ?? ""} onChange={(e) => setEditing({ ...editing!, code: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={editing?.account_type} onValueChange={(v) => setEditing({ ...editing!, account_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2 text-sm">
          <span className="font-medium">{selectedCount} selected</span>
          <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>Clear</Button>
        </div>
      )}

      <DataGrid
        table={table}
        recordCount={filteredRows.length}
        isLoading={loading && rows.length === 0}
        loadingMode="skeleton"
        onRowDoubleClick={(r) => { setEditing(r); setOpen(true) }}
        tableLayout={{
          columnsPinnable: true,
          columnsResizable: false,
          columnsMovable: true,
          columnsVisibility: true,
        }}
      >
        <Frame className="w-full flex-1 min-h-0 flex flex-col" stacked dense>
          <FrameHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <FrameTitle>Chart of Accounts</FrameTitle>
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <InputGroup className="w-full sm:w-96">
                <InputGroupAddon align="inline-start"><SearchIcon /></InputGroupAddon>
                <InputGroupInput
                  placeholder="Search..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q.length > 0 && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton aria-label="Clear search" size="icon-xs" onClick={() => setQ("")}>
                      <XIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] sm:w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => { setEditing({ account_type: "asset" }); setOpen(true) }}>
                <Plus /> New
              </Button>
            </div>
          </FrameHeader>
          <FramePanel ref={panelRef} className="flex-1 min-h-0 overflow-hidden p-0 shadow-none">
            <DataGridScrollArea className="h-full">
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

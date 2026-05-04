import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type PaginationState,
  type Row,
  type RowSelectionState,
} from "@tanstack/react-table"
import { api, type Account, type Txn } from "@/lib/api"
import { useDebouncedValue } from "@/lib/loading"
import { fmtMoney, titleCaseType } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CurrencyInput } from "@/components/ui/currency-input"
// NOTE: shadcn Table is intentionally retained ONLY for the editable journal-lines form table inside the dialog (converting it to DataGrid would break inline editability).
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/reui/badge"
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
import {
  InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton,
} from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
import {
  type DateSelectorValue,
} from "@/components/reui/date-selector"
import { DateSelectorPopover } from "@/components/date-selector-popover"
import { DatePicker } from "@/components/date-picker"
import {
  FloatingToolbar,
  FloatingToolbarSeparator,
} from "@/components/floating-toolbar"
import { useAutoFitPageSize } from "@/hooks/use-auto-fit-page-size"
import {
  invalidateCache,
  invalidateCachePrefix,
  useCachedFetch,
} from "@/hooks/use-cached-fetch"

const DASHBOARD_CACHE_KEYS = [
  "dashboard:reports/profit_and_loss",
  "dashboard:reports/cashflow",
] as const

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

const TYPE_BADGE: Record<string, "success-outline" | "destructive-outline" | "info-outline" | "warning-outline"> = {
  deposit: "success-outline",
  withdrawal: "destructive-outline",
  journal_entry: "info-outline",
  receipt: "warning-outline",
}

const FILTER_TYPES = ["deposit", "withdrawal", "journal_entry", "receipt"] as const

const Req = ({ children }: { children: React.ReactNode }) => (
  <Label>
    {children} <span className="text-destructive" aria-hidden>*</span>
  </Label>
)

type SimpleKind = "deposit" | "withdrawal"

type SimpleForm = {
  date: string
  description: string
  reference: string
  kind: SimpleKind
  account_id?: number
  category_id?: number
  amount: number
}

type JournalForm = {
  date: string
  description: string
  reference: string
  lines: Array<{ account_id?: number; debit: number; credit: number; memo?: string }>
}

const today = () => new Date().toISOString().slice(0, 10)

const dateToIso = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : "")

export default function Transactions() {
  const [q, setQ] = useState("")
  const [type, setType] = useState<string>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [rangeValue, setRangeValue] = useState<DateSelectorValue | undefined>()

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const { ref: panelRef } = useAutoFitPageSize(44, 40)

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"simple" | "journal">("simple")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [simple, setSimple] = useState<SimpleForm>({
    date: today(), description: "", reference: "", kind: "deposit", amount: 0,
  })
  const [journal, setJournal] = useState<JournalForm>({
    date: today(), description: "", reference: "",
    lines: [
      { account_id: undefined, debit: 0, credit: 0, memo: "" },
      { account_id: undefined, debit: 0, credit: 0, memo: "" },
    ],
  })

  const debouncedQ = useDebouncedValue(q, 250)

  const txKey = `transactions:q=${debouncedQ}|type=${type}|from=${from}|to=${to}`

  const { data: rowsData, loading: txLoading, refetch: refetchTxns } =
    useCachedFetch<Txn[]>(
      txKey,
      () =>
        api
          .get("/transactions", {
            params: {
              ...(debouncedQ ? { q: debouncedQ } : {}),
              ...(type !== "all" ? { type } : {}),
              ...(from ? { from } : {}),
              ...(to ? { to } : {}),
            },
          })
          .then((r) => r.data as Txn[]),
    )
  const rows = rowsData ?? []
  // Only show skeleton on the very first load (no cached data yet); silent
  // background revalidation otherwise so navigating back doesn't flash.
  const loading = txLoading && rowsData === undefined

  const { data: accountsData } = useCachedFetch<Account[]>(
    "accounts:all",
    () => api.get("/accounts").then((r) => r.data as Account[]),
  )
  const accounts = useMemo(() => accountsData ?? [], [accountsData])

  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "asset"),
    [accounts],
  )
  const incomeAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "income"),
    [accounts],
  )
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "expense"),
    [accounts],
  )

  const resetForms = () => {
    setSimple({ date: today(), description: "", reference: "", kind: "deposit", amount: 0 })
    setJournal({
      date: today(), description: "", reference: "",
      lines: [
        { account_id: undefined, debit: 0, credit: 0, memo: "" },
        { account_id: undefined, debit: 0, credit: 0, memo: "" },
      ],
    })
    setEditingId(null)
    setTab("simple")
  }

  const newTxn = () => { resetForms(); setOpen(true) }

  const editTxn = (t: Txn) => {
    setEditingId(t.id)
    if (t.transaction_type === "journal_entry" || t.journal_lines.length !== 2) {
      setTab("journal")
      setJournal({
        date: t.date, description: t.description, reference: t.reference ?? "",
        lines: t.journal_lines.map((l) => ({
          account_id: l.account_id, debit: Number(l.debit), credit: Number(l.credit), memo: l.memo,
        })),
      })
    } else {
      const debitLine = t.journal_lines.find((l) => Number(l.debit) > 0)
      const creditLine = t.journal_lines.find((l) => Number(l.credit) > 0)
      const kind: SimpleKind = t.transaction_type === "withdrawal" ? "withdrawal" : "deposit"
      const accountLine = kind === "deposit" ? debitLine : creditLine
      const categoryLine = kind === "deposit" ? creditLine : debitLine
      setTab("simple")
      setSimple({
        date: t.date, description: t.description, reference: t.reference ?? "",
        kind, amount: Number(t.amount),
        account_id: accountLine?.account_id, category_id: categoryLine?.account_id,
      })
    }
    setOpen(true)
  }

  const simpleValid = useMemo(() => (
    !!simple.date && !!simple.account_id && !!simple.category_id &&
    !!simple.description.trim() && simple.amount > 0
  ), [simple])

  const journalTotals = useMemo(() => {
    const debit = journal.lines.reduce((s, l) => s + Number(l.debit || 0), 0)
    const credit = journal.lines.reduce((s, l) => s + Number(l.credit || 0), 0)
    return { debit, credit, diff: debit - credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 }
  }, [journal.lines])

  const journalValid = useMemo(() => (
    !!journal.date && !!journal.description.trim() && journalTotals.balanced &&
    journal.lines.every((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
  ), [journal, journalTotals.balanced])

  const canSave = tab === "simple" ? simpleValid : journalValid

  const updateLine = (idx: number, patch: Partial<JournalForm["lines"][number]>) => {
    setJournal((j) => {
      const lines = [...j.lines]
      lines[idx] = { ...lines[idx], ...patch }
      return { ...j, lines }
    })
  }

  const addLine = () =>
    setJournal((j) => ({ ...j, lines: [...j.lines, { account_id: undefined, debit: 0, credit: 0, memo: "" }] }))

  const removeLine = (idx: number) =>
    setJournal((j) => ({ ...j, lines: j.lines.filter((_, i) => i !== idx) }))

  const save = async () => {
    let payload: any
    if (tab === "simple") {
      if (!simple.account_id || !simple.category_id || simple.amount <= 0 || !simple.description) {
        toast.error("Fill in account, category, amount, description"); return
      }
      const lines = simple.kind === "deposit"
        ? [
            { account_id: simple.account_id, debit: simple.amount, credit: 0 },
            { account_id: simple.category_id, debit: 0, credit: simple.amount },
          ]
        : [
            { account_id: simple.category_id, debit: simple.amount, credit: 0 },
            { account_id: simple.account_id, debit: 0, credit: simple.amount },
          ]
      payload = { transaction: {
        date: simple.date, description: simple.description, reference: simple.reference,
        transaction_type: simple.kind, amount: simple.amount,
        journal_lines_attributes: lines,
      } }
    } else {
      if (!journalTotals.balanced) { toast.error("Debits must equal credits and be > 0"); return }
      if (!journal.description) { toast.error("Description required"); return }
      payload = { transaction: {
        date: journal.date, description: journal.description, reference: journal.reference,
        transaction_type: "journal_entry", amount: journalTotals.debit,
        journal_lines_attributes: journal.lines,
      } }
    }
    const wasUpdate = !!editingId
    try {
      if (editingId) await api.put(`/transactions/${editingId}`, payload)
      else await api.post("/transactions", payload)
      setOpen(false); resetForms()
      invalidateCachePrefix("transactions:")
      invalidateCache(...DASHBOARD_CACHE_KEYS)
      refetchTxns()
      toast.success(wasUpdate ? "Transaction updated" : "Transaction created")
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this transaction?")) return
    try {
      await api.delete(`/transactions/${id}`)
      invalidateCachePrefix("transactions:")
      invalidateCache(...DASHBOARD_CACHE_KEYS)
      refetchTxns()
      toast.error("Transaction deleted")
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  // Filter date-range handlers
  const handleRangeChange = (v: DateSelectorValue | undefined) => {
    setRangeValue(v)
    setFrom(v ? dateToIso(v.startDate) : "")
    setTo(v ? dateToIso(v.endDate) : "")
  }

  const columns = useMemo<ColumnDef<Txn>[]>(() => [
    {
      id: "select",
      header: () => <DataGridTableRowSelectAll />,
      cell: ({ row }) => <DataGridTableRowSelect row={row} />,
      enableSorting: false,
      enableResizing: false,
      size: 35,
    },
    {
      accessorKey: "date",
      header: "Date",
      size: 128,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.date}</span>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
    },
    {
      accessorKey: "reference",
      header: "Reference",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.reference}</span>,
    },
    {
      accessorKey: "transaction_type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant={TYPE_BADGE[row.original.transaction_type] ?? "info-outline"}>
          {titleCaseType(row.original.transaction_type)}
        </Badge>
      ),
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{fmtMoney(Number(row.original.amount))}</div>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 60,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ActionsCell row={row} onEdit={editTxn} onDelete={(id) => remove(id as number)} />
        </div>
      ),
      enableSorting: false,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const table = useReactTable({
    data: rows,
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
    if (!confirm(`Delete ${selectedCount} transaction(s)?`)) return
    const n = selectedCount
    try {
      await api.post("/transactions/bulk_destroy", { ids: selectedIds })
      setRowSelection({})
      invalidateCachePrefix("transactions:")
      invalidateCache(...DASHBOARD_CACHE_KEYS)
      refetchTxns()
      toast.error(`${n} transaction${n === 1 ? "" : "s"} deleted`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <FloatingToolbar open={selectedCount > 0}>
        <span className="px-2 text-sm font-medium tabular-nums">
          {selectedCount} selected
        </span>
        <FloatingToolbarSeparator />
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={bulkDelete}
        >
          <Trash2 /> Delete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => setRowSelection({})}
        >
          Clear
        </Button>
      </FloatingToolbar>

      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={loading && rows.length === 0}
        loadingMode="skeleton"
        onRowDoubleClick={editTxn}
        tableLayout={{
          columnsPinnable: true,
          columnsResizable: false,
          columnsMovable: true,
          columnsVisibility: true,
        }}
      >
        <Frame className="w-full flex-1 min-h-0 flex flex-col" stacked dense>
          <FrameHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <FrameTitle>Transactions</FrameTitle>
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
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-[140px] sm:w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {FILTER_TYPES.map((t) => <SelectItem key={t} value={t}>{titleCaseType(t)}</SelectItem>)}
                </SelectContent>
              </Select>
              <DateSelectorPopover
                value={rangeValue}
                onChange={handleRangeChange}
                allowRange
                defaultFilterType="between"
                periodTypes={["day"]}
              />
              <Button onClick={newTxn}><Plus /> New</Button>
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

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForms() }}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>

          <ToggleGroup
            value={tab}
            onValueChange={(v) => setTab(v as any)}
            ariaLabel="Transaction type"
            className="w-full"
            stretch
          >
            <ToggleGroupItem value="simple">Deposit / Withdrawal</ToggleGroupItem>
            <ToggleGroupItem value="journal">Journal Entry</ToggleGroupItem>
          </ToggleGroup>

          {tab === "simple" && (
            <div className="grid gap-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Req>Date</Req>
                  <DatePicker
                    value={simple.date}
                    onChange={(d) => setSimple({ ...simple, date: d })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Reference</Label>
                  <Input value={simple.reference} onChange={(e) => setSimple({ ...simple, reference: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Req>Type</Req>
                  <Select value={simple.kind} onValueChange={(v) => setSimple({ ...simple, kind: v as SimpleKind })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Req>Account</Req>
                  <Select
                    value={simple.account_id ? String(simple.account_id) : undefined}
                    onValueChange={(v) => setSimple({ ...simple, account_id: Number(v) })}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {cashAccounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Req>Amount</Req>
                  <CurrencyInput value={simple.amount}
                    onChange={(e) => setSimple({ ...simple, amount: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Req>Category</Req>
                  <Select
                    value={simple.category_id ? String(simple.category_id) : undefined}
                    onValueChange={(v) => setSimple({ ...simple, category_id: Number(v) })}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder={simple.kind === "deposit" ? "Income category" : "Expense category"} /></SelectTrigger>
                    <SelectContent>
                      {(simple.kind === "deposit" ? incomeAccounts : expenseAccounts).map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Req>Description</Req>
                <Textarea rows={3} value={simple.description} onChange={(e) => setSimple({ ...simple, description: e.target.value })} placeholder="Write a description" />
              </div>
            </div>
          )}

          {tab === "journal" && (
            <div className="grid gap-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Req>Date</Req>
                  <DatePicker
                    value={journal.date}
                    onChange={(d) => setJournal({ ...journal, date: d })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Reference</Label>
                  <Input value={journal.reference} onChange={(e) => setJournal({ ...journal, reference: e.target.value })} placeholder="Optional" />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Journal Lines</Label>
                  <Button size="sm" variant="outline" onClick={addLine}><Plus /> Add line</Button>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  {/* Editable journal-lines form table — kept as plain shadcn Table (form, not a data grid). */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Account <span className="text-destructive">*</span></TableHead>
                        <TableHead className="w-44 text-right">Debit <span className="text-destructive">*</span></TableHead>
                        <TableHead className="w-44 text-right">Credit <span className="text-destructive">*</span></TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {journal.lines.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input value={l.memo ?? ""} onChange={(e) => updateLine(i, { memo: e.target.value })} placeholder="Write a description" />
                          </TableCell>
                          <TableCell>
                            <Select value={l.account_id ? String(l.account_id) : undefined} onValueChange={(v) => updateLine(i, { account_id: Number(v) })}>
                              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                              <SelectContent>
                                {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell><CurrencyInput value={l.debit} onChange={(e) => updateLine(i, { debit: Number(e.target.value) })} /></TableCell>
                          <TableCell><CurrencyInput value={l.credit} onChange={(e) => updateLine(i, { credit: Number(e.target.value) })} /></TableCell>
                          <TableCell><Button size="icon" variant="ghost" onClick={() => removeLine(i)}><Trash2 /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="ml-auto rounded-md border bg-muted/30 px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div className="text-muted-foreground">Total debits</div>
                <div className="text-muted-foreground text-right">Total credits</div>
                <div className="font-semibold tabular-nums">{fmtMoney(journalTotals.debit)}</div>
                <div className="font-semibold tabular-nums text-right">{fmtMoney(journalTotals.credit)}</div>
                <div className="text-muted-foreground col-span-1">Difference</div>
                <div className={"text-right tabular-nums col-span-1 " + (journalTotals.balanced ? "text-emerald-500" : "text-destructive")}>
                  {fmtMoney(journalTotals.diff)}
                </div>
              </div>

              <div className="grid gap-2">
                <Req>Description</Req>
                <Textarea rows={3} value={journal.description} onChange={(e) => setJournal({ ...journal, description: e.target.value })} placeholder="Write a description" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!canSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

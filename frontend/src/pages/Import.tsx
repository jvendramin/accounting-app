import { useEffect, useMemo, useState } from "react"
import { Importer, ImporterField } from "react-csv-importer"
import "react-csv-importer/dist/index.css"
import "@/styles/csv-importer.css"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type PaginationState,
  type Row,
} from "@tanstack/react-table"
import { api, type Account } from "@/lib/api"
import { fmtMoney } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/reui/badge"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuGroup, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  DataGrid, DataGridTable, DataGridScrollArea, DataGridPagination,
} from "@/components/reui/data-grid"
import {
  Frame, FramePanel, FrameHeader, FrameTitle, FrameFooter,
} from "@/components/reui/frame"
import { DatePicker } from "@/components/date-picker"
import { Download, MoreHorizontalIcon, RotateCcw, PencilIcon, TrashIcon } from "lucide-react"
import { invalidateCache } from "@/hooks/use-cached-fetch"
import { toast } from "sonner"

const ACCOUNTS_TEMPLATE_CSV = `name,account_type,code,description
Operating Cash,asset,1010,Primary checking account
Accounts Receivable,asset,1100,Customer invoices outstanding
Accounts Payable,liability,2010,Vendor bills outstanding
Owner Equity,equity,3000,Owner's equity account
Service Revenue,income,4000,Revenue from services
Office Expenses,expense,6010,General office costs
Software Subscriptions,expense,6020,SaaS tools
`

const TRANSACTIONS_TEMPLATE_CSV = `date,description,kind,account_name,category_name,amount,reference
2026-01-05,Client invoice payment,deposit,Operating Cash,Service Revenue,2500.00,INV-1001
2026-01-08,SaaS subscription,withdrawal,Operating Cash,Software Subscriptions,49.00,
2026-01-15,Office supplies,withdrawal,Operating Cash,Office Expenses,127.43,RCPT-882
2026-01-22,Consulting fee,deposit,Operating Cash,Service Revenue,1800.00,INV-1002
`

function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

type AccountRow = {
  name: string; code?: string; account_type: string; description?: string
}
type RawTxnRow = {
  date: string; description: string; reference?: string; kind: string
  account_name: string; category_name: string; amount: string
}

type Kind = "deposit" | "withdrawal" | "journal_entry"

interface PendingTxn {
  id: string
  date: string
  description: string
  reference: string
  kind: Kind
  account_id?: number
  category_id?: number
  amount: number
  // raw lookup strings, kept so users can resolve later if account_id is missing
  account_name?: string
  category_name?: string
}

const lookupId = (accounts: Account[], name?: string): number | undefined => {
  if (!name) return undefined
  const n = name.trim().toLowerCase()
  return accounts.find(
    (a) => a.name.toLowerCase() === n || a.code?.toLowerCase() === n,
  )?.id
}

const normalizeKind = (v?: string): Kind =>
  (v ?? "").toLowerCase().includes("with") ? "withdrawal" : "deposit"

let pendingIdSeq = 0
const nextId = () => `pending-${++pendingIdSeq}-${Date.now()}`

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tab, setTab] = useState("transactions")
  const [pending, setPending] = useState<PendingTxn[]>([])
  const [defaultKind, setDefaultKind] = useState<
    "csv" | "deposit" | "withdrawal" | "journal_entry"
  >("csv")
  const [defaultAccountId, setDefaultAccountId] = useState<string>("csv")
  const [editing, setEditing] = useState<PendingTxn | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })

  useEffect(() => {
    api.get("/accounts").then((r) => setAccounts(r.data))
  }, [])

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

  // CSV parsed → store as PendingTxn[], do NOT hit the API yet
  const stagePending = (rows: RawTxnRow[]) => {
    const overrideAccountId =
      defaultAccountId === "csv" ? undefined : Number(defaultAccountId)
    const staged: PendingTxn[] = rows.map((r) => {
      const kind: Kind =
        defaultKind === "csv" ? normalizeKind(r.kind) : defaultKind
      return {
        id: nextId(),
        date: r.date,
        description: r.description ?? "",
        reference: r.reference ?? "",
        kind,
        account_id:
          overrideAccountId ?? lookupId(accounts, r.account_name),
        category_id: lookupId(accounts, r.category_name),
        amount: Number(r.amount) || 0,
        account_name: r.account_name,
        category_name: r.category_name,
      }
    })
    setPending((prev) => [...prev, ...staged])
    toast.success(
      `Staged ${staged.length} transaction${staged.length === 1 ? "" : "s"} — review then import`,
    )
  }

  const flipKind = (id: string) =>
    setPending((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const next: Kind =
          p.kind === "deposit"
            ? "withdrawal"
            : p.kind === "withdrawal"
              ? "journal_entry"
              : "deposit"
        return { ...p, kind: next }
      }),
    )

  const removePending = (id: string) =>
    setPending((prev) => prev.filter((p) => p.id !== id))

  const clearPending = () => {
    setPending([])
    toast.success("Cleared staged rows")
  }

  const importAccounts = async (rows: AccountRow[]) => {
    const payload = {
      accounts: rows.map((r) => ({
        name: r.name,
        code: r.code,
        account_type: (r.account_type || "asset").toLowerCase(),
        description: r.description,
      })),
    }
    try {
      const res = await api.post("/accounts/bulk_create", payload)
      const { created, errors } = res.data
      const msg = `Imported ${created.length} account${created.length === 1 ? "" : "s"}${errors.length ? `, ${errors.length} error${errors.length === 1 ? "" : "s"}` : ""}`
      if (errors.length) {
        toast.warning(msg)
        console.warn(errors)
      } else {
        toast.success(msg)
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  const importAllPending = async () => {
    if (pending.length === 0) return
    const invalid = pending.filter(
      (p) => !p.date || !p.account_id || !p.category_id || !p.description || p.amount <= 0,
    )
    if (invalid.length > 0) {
      toast.error(`${invalid.length} row${invalid.length === 1 ? "" : "s"} missing required fields — fix before importing`)
      return
    }
    setSubmitting(true)
    try {
      const transactions = pending.map((p) => ({
        date: p.date,
        description: p.description,
        reference: p.reference,
        kind: p.kind,
        account_id: p.account_id,
        category_id: p.category_id,
        amount: p.amount,
      }))
      const res = await api.post("/transactions/bulk_create", { transactions })
      const { created, errors } = res.data
      const msg = `Imported ${created.length} transaction${created.length === 1 ? "" : "s"}${errors.length ? `, ${errors.length} error${errors.length === 1 ? "" : "s"}` : ""}`
      if (errors.length) {
        toast.warning(msg)
        console.warn(errors)
      } else {
        toast.success(msg)
        setPending([])
      }
      invalidateCache(
        "dashboard:reports/profit_and_loss",
        "dashboard:reports/cashflow",
      )
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const saveEditing = () => {
    if (!editing) return
    setPending((prev) => prev.map((p) => (p.id === editing.id ? editing : p)))
    setEditing(null)
  }

  const columns = useMemo<ColumnDef<PendingTxn>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        size: 110,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.date || "—"}</span>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.description || <em className="text-muted-foreground">missing</em>}</span>
        ),
      },
      {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.reference || "—"}</span>
        ),
      },
      {
        accessorKey: "kind",
        header: "Kind",
        size: 130,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => flipKind(row.original.id)}
            className="rounded-full"
            title="Click to flip deposit / withdrawal"
          >
            <Badge
              variant={
                row.original.kind === "deposit"
                  ? "success-outline"
                  : row.original.kind === "withdrawal"
                    ? "destructive-outline"
                    : "info-outline"
              }
            >
              {row.original.kind === "journal_entry"
                ? "Journal entry"
                : row.original.kind === "deposit"
                  ? "Deposit"
                  : "Withdrawal"}
            </Badge>
          </button>
        ),
      },
      {
        accessorKey: "account_id",
        header: "Account",
        cell: ({ row }) => {
          const acct = accounts.find((a) => a.id === row.original.account_id)
          if (acct) return <span>{acct.name}</span>
          return (
            <span className="text-destructive text-xs">
              {row.original.account_name ? `“${row.original.account_name}” not found` : "missing"}
            </span>
          )
        },
      },
      {
        accessorKey: "category_id",
        header: "Category",
        cell: ({ row }) => {
          const cat = accounts.find((a) => a.id === row.original.category_id)
          if (cat) return <span>{cat.name}</span>
          return (
            <span className="text-destructive text-xs">
              {row.original.category_name ? `“${row.original.category_name}” not found` : "missing"}
            </span>
          )
        },
      },
      {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        size: 120,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{fmtMoney(row.original.amount)}</div>
        ),
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      },
      {
        id: "actions",
        header: "",
        size: 60,
        cell: ({ row }) => <ActionsCell row={row} onEdit={setEditing} onDelete={removePending} />,
        enableSorting: false,
      },
    ],
    [accounts],
  )

  const table = useReactTable({
    data: pending,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => r.id,
    state: { pagination },
    onPaginationChange: setPagination,
  })

  const editingValid = editing
    ? !!editing.date && !!editing.description && editing.amount > 0 && !!editing.account_id && !!editing.category_id
    : false

  const editingCategoryAccounts =
    editing?.kind === "deposit" ? incomeAccounts : expenseAccounts

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Import from CSV</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a CSV exported from another platform, then map your columns to the right fields.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <ToggleGroup
              value={tab}
              onValueChange={setTab}
              ariaLabel="Import type"
              className="w-full max-w-md"
              stretch
            >
              <ToggleGroupItem value="transactions">Transactions</ToggleGroupItem>
              <ToggleGroupItem value="accounts">Accounts</ToggleGroupItem>
            </ToggleGroup>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                tab === "transactions"
                  ? downloadCsv("transactions-template.csv", TRANSACTIONS_TEMPLATE_CSV)
                  : downloadCsv("accounts-template.csv", ACCOUNTS_TEMPLATE_CSV)
              }
            >
              <Download /> Download template
            </Button>
          </div>

          {tab === "transactions" && (
            <div className="grid gap-4 pt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-dashed border-border bg-muted/30 px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Default kind</span>
                    <span className="text-xs text-muted-foreground">
                      Force every row to one type.
                    </span>
                  </div>
                  <Select
                    value={defaultKind}
                    onValueChange={(v) =>
                      setDefaultKind(v as "csv" | "deposit" | "withdrawal" | "journal_entry")
                    }
                  >
                    <SelectTrigger className="ml-auto w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">From CSV</SelectItem>
                      <SelectItem value="withdrawal">Import Withdrawals</SelectItem>
                      <SelectItem value="deposit">Import Deposits</SelectItem>
                      <SelectItem value="journal_entry">Import Journal Entries</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-dashed border-border bg-muted/30 px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Default account</span>
                    <span className="text-xs text-muted-foreground">
                      Override the CSV's account column.
                    </span>
                  </div>
                  <Select
                    value={defaultAccountId}
                    onValueChange={setDefaultAccountId}
                  >
                    <SelectTrigger className="ml-auto w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">From CSV</SelectItem>
                      {cashAccounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.code ? `${a.code} — ${a.name}` : a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Importer
                restartable
                processChunk={async (rows) => stagePending(rows as unknown as RawTxnRow[])}
              >
                <ImporterField name="date" label="Date" />
                <ImporterField name="description" label="Description" />
                <ImporterField name="kind" label="Kind (deposit / withdrawal)" optional />
                <ImporterField name="account_name" label="Account (cash/bank name or code)" optional />
                <ImporterField name="category_name" label="Category (income/expense name or code)" optional />
                <ImporterField name="amount" label="Amount" />
                <ImporterField name="reference" label="Reference" optional />
              </Importer>
            </div>
          )}

          {tab === "accounts" && (
            <div className="pt-4">
              <Importer
                restartable
                processChunk={async (rows) => importAccounts(rows as unknown as AccountRow[])}
              >
                <ImporterField name="name" label="Name" />
                <ImporterField name="account_type" label="Type (asset / liability / equity / income / expense)" />
                <ImporterField name="code" label="Code" optional />
                <ImporterField name="description" label="Description" optional />
              </Importer>
            </div>
          )}
        </CardContent>
      </Card>

      {tab === "transactions" && pending.length > 0 && (
        <DataGrid
          table={table}
          recordCount={pending.length}
          tableLayout={{ columnsResizable: false, columnsMovable: false, columnsVisibility: false }}
        >
          <Frame className="w-full flex-1 min-h-0 flex flex-col" stacked dense>
            <FrameHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <FrameTitle>Staged transactions</FrameTitle>
                <p className="text-xs text-muted-foreground">
                  Click the kind badge to flip deposit / withdrawal. Edit a row to fix accounts or any other field.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Button size="sm" variant="ghost" onClick={clearPending} disabled={submitting}>
                  <RotateCcw /> Clear
                </Button>
                <Button size="sm" onClick={importAllPending} disabled={submitting || pending.length === 0}>
                  {submitting ? "Importing..." : `Import ${pending.length} transaction${pending.length === 1 ? "" : "s"}`}
                </Button>
              </div>
            </FrameHeader>
            <FramePanel className="flex-1 min-h-0 overflow-hidden p-0 shadow-none">
              <DataGridScrollArea className="h-full">
                <DataGridTable />
              </DataGridScrollArea>
            </FramePanel>
            <FrameFooter className="py-1.5 pr-2 pl-2.5">
              <DataGridPagination />
            </FrameFooter>
          </Frame>
        </DataGrid>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="grid gap-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Date <span className="text-destructive">*</span></Label>
                  <DatePicker
                    value={editing.date}
                    onChange={(d) => setEditing({ ...editing, date: d })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Reference</Label>
                  <Input
                    value={editing.reference}
                    onChange={(e) => setEditing({ ...editing, reference: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Type <span className="text-destructive">*</span></Label>
                  <ToggleGroup
                    value={editing.kind}
                    onValueChange={(v) =>
                      setEditing({ ...editing, kind: v as Kind, category_id: undefined })
                    }
                    ariaLabel="Transaction kind"
                    stretch
                  >
                    <ToggleGroupItem value="deposit">Deposit</ToggleGroupItem>
                    <ToggleGroupItem value="withdrawal">Withdrawal</ToggleGroupItem>
                    <ToggleGroupItem value="journal_entry">Journal entry</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="grid gap-2">
                  <Label>Account <span className="text-destructive">*</span></Label>
                  <Select
                    value={editing.account_id ? String(editing.account_id) : undefined}
                    onValueChange={(v) => setEditing({ ...editing, account_id: Number(v) })}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {cashAccounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Amount <span className="text-destructive">*</span></Label>
                  <CurrencyInput
                    value={editing.amount}
                    onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Category <span className="text-destructive">*</span></Label>
                  <Select
                    value={editing.category_id ? String(editing.category_id) : undefined}
                    onValueChange={(v) => setEditing({ ...editing, category_id: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={editing.kind === "deposit" ? "Income category" : "Expense category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {editingCategoryAccounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Description <span className="text-destructive">*</span></Label>
                <Textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Write a description"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEditing} disabled={!editingValid}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ActionsCell({
  row, onEdit, onDelete,
}: {
  row: Row<PendingTxn>
  onEdit: (r: PendingTxn) => void
  onDelete: (id: string) => void
}) {
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

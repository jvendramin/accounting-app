"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { TableBody } from "react-aria-components"
import { EllipsisVerticalIcon } from "@heroicons/react/16/solid"
import {
  Table,
  TableCell,
  TableColumn,
  TableHeader as IntentTableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { SearchField, SearchInput } from "@/components/ui/search-field"
import { TextField } from "@/components/ui/text-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/field"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tab, TabList, Tabs } from "@/components/ui/tabs"
import { DatePicker, DatePickerTrigger } from "@/components/ui/date-picker"
import {
  DateRangePicker,
  DateRangePickerTrigger,
} from "@/components/ui/date-range-picker"
import { parseDate, type CalendarDate } from "@internationalized/date"
import { IconPlus, IconTrash, IconX } from "@/components/icons"
import { toast } from "sonner"
import { fmtMoney, titleCase } from "@/lib/format"
import { api, type Account, type Txn } from "@/lib/api"
import {
  invalidateCache,
  invalidateCachePrefix,
  useCachedFetch,
} from "@/hooks/use-cached-fetch"

const TYPES = ["deposit", "withdrawal", "journal_entry", "receipt"] as const
const TYPE_INTENT: Record<
  string,
  "primary" | "secondary" | "warning" | "danger" | "success"
> = {
  deposit: "success",
  withdrawal: "danger",
  journal_entry: "primary",
  receipt: "warning",
}

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
  lines: Array<{
    account_id?: number
    debit: number
    credit: number
    memo?: string
  }>
}

const today = () => new Date().toISOString().slice(0, 10)

const useDebouncedValue = <T,>(v: T, ms: number) => {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

type SortDesc = { column: string; direction: "ascending" | "descending" }

export default function TransactionsPage() {
  const [q, setQ] = useState("")
  const [type, setType] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const debouncedQ = useDebouncedValue(q, 250)
  const [sortDescriptor, setSortDescriptor] = useState<SortDesc>({
    column: "date",
    direction: "descending",
  })

  const txKey = `transactions:q=${debouncedQ}|type=${type}|from=${from}|to=${to}`
  const {
    data: rowsData,
    loading: txLoading,
    refetch: refetchTxns,
  } = useCachedFetch<Txn[]>(txKey, () =>
    api.get("/api/transactions", {
      ...(debouncedQ ? { q: debouncedQ } : {}),
      ...(type !== "all" ? { type } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
  )
  const rawRows = rowsData ?? []
  const rows = useMemo(() => {
    const { column, direction } = sortDescriptor
    return [...rawRows].sort((a, b) => {
      const av: any = (a as any)[column] ?? (column === "transaction_type" ? (a as any).transactionType : "")
      const bv: any = (b as any)[column] ?? (column === "transaction_type" ? (b as any).transactionType : "")
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv))
      return direction === "descending" ? -cmp : cmp
    })
  }, [rawRows, sortDescriptor])
  const loading = txLoading && rowsData === undefined

  const { data: accountsData } = useCachedFetch<Account[]>(
    "accounts:all",
    () => api.get("/api/accounts"),
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

  const [open, setOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Auto-open the create modal when arrived via ?new=1 (from Dashboard quick-create).
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      resetForms()
      setOpen(true)
      router.replace(pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  const [tab, setTab] = useState<"simple" | "journal">("simple")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [simple, setSimple] = useState<SimpleForm>({
    date: today(),
    description: "",
    reference: "",
    kind: "deposit",
    amount: 0,
  })
  const [journal, setJournal] = useState<JournalForm>({
    date: today(),
    description: "",
    reference: "",
    lines: [
      { account_id: undefined, debit: 0, credit: 0, memo: "" },
      { account_id: undefined, debit: 0, credit: 0, memo: "" },
    ],
  })

  const resetForms = () => {
    setSimple({
      date: today(),
      description: "",
      reference: "",
      kind: "deposit",
      amount: 0,
    })
    setJournal({
      date: today(),
      description: "",
      reference: "",
      lines: [
        { account_id: undefined, debit: 0, credit: 0, memo: "" },
        { account_id: undefined, debit: 0, credit: 0, memo: "" },
      ],
    })
    setEditingId(null)
    setTab("simple")
  }
  const newTxn = () => {
    resetForms()
    setOpen(true)
  }

  const editTxn = (t: Txn) => {
    setEditingId(t.id)
    const txnType = (t as any).transaction_type ?? t.transactionType
    if (txnType === "journal_entry" || t.journal_lines.length !== 2) {
      setTab("journal")
      setJournal({
        date: t.date,
        description: t.description,
        reference: t.reference ?? "",
        lines: t.journal_lines.map((l) => ({
          account_id: l.account_id,
          debit: Number(l.debit),
          credit: Number(l.credit),
          memo: l.memo ?? "",
        })),
      })
    } else {
      const debitLine = t.journal_lines.find((l) => Number(l.debit) > 0)
      const creditLine = t.journal_lines.find((l) => Number(l.credit) > 0)
      const kind: SimpleKind =
        txnType === "withdrawal" ? "withdrawal" : "deposit"
      const accountLine = kind === "deposit" ? debitLine : creditLine
      const categoryLine = kind === "deposit" ? creditLine : debitLine
      setTab("simple")
      setSimple({
        date: t.date,
        description: t.description,
        reference: t.reference ?? "",
        kind,
        amount: Number(t.amount),
        account_id: accountLine?.account_id,
        category_id: categoryLine?.account_id,
      })
    }
    setOpen(true)
  }

  const journalTotals = useMemo(() => {
    const debit = journal.lines.reduce((s, l) => s + Number(l.debit || 0), 0)
    const credit = journal.lines.reduce((s, l) => s + Number(l.credit || 0), 0)
    return {
      debit,
      credit,
      diff: debit - credit,
      balanced: Math.abs(debit - credit) < 0.005 && debit > 0,
    }
  }, [journal.lines])

  const updateLine = (
    idx: number,
    patch: Partial<JournalForm["lines"][number]>,
  ) => {
    setJournal((j) => {
      const lines = [...j.lines]
      lines[idx] = { ...lines[idx], ...patch }
      return { ...j, lines }
    })
  }
  const addLine = () =>
    setJournal((j) => ({
      ...j,
      lines: [
        ...j.lines,
        { account_id: undefined, debit: 0, credit: 0, memo: "" },
      ],
    }))
  const removeLine = (idx: number) =>
    setJournal((j) => ({ ...j, lines: j.lines.filter((_, i) => i !== idx) }))

  const save = async () => {
    let payload: any
    if (tab === "simple") {
      if (
        !simple.account_id ||
        !simple.category_id ||
        simple.amount <= 0 ||
        !simple.description
      ) {
        toast.error("Fill in account, category, amount, description")
        return
      }
      const lines =
        simple.kind === "deposit"
          ? [
              { account_id: simple.account_id, debit: simple.amount, credit: 0 },
              { account_id: simple.category_id, debit: 0, credit: simple.amount },
            ]
          : [
              { account_id: simple.category_id, debit: simple.amount, credit: 0 },
              { account_id: simple.account_id, debit: 0, credit: simple.amount },
            ]
      payload = {
        transaction: {
          date: simple.date,
          description: simple.description,
          reference: simple.reference,
          transaction_type: simple.kind,
          amount: simple.amount,
          journal_lines_attributes: lines,
        },
      }
    } else {
      if (!journalTotals.balanced) {
        toast.error("Debits must equal credits and be > 0")
        return
      }
      if (!journal.description) {
        toast.error("Description required")
        return
      }
      payload = {
        transaction: {
          date: journal.date,
          description: journal.description,
          reference: journal.reference,
          transaction_type: "journal_entry",
          amount: journalTotals.debit,
          journal_lines_attributes: journal.lines,
        },
      }
    }
    const wasUpdate = !!editingId
    try {
      if (editingId)
        await api.put(`/api/transactions/${editingId}`, payload)
      else await api.post("/api/transactions", payload)
      setOpen(false)
      resetForms()
      invalidateCachePrefix("transactions:")
      invalidateCache(
        "dashboard:reports/profit_and_loss",
        "dashboard:reports/cashflow",
      )
      refetchTxns()
      toast.success(wasUpdate ? "Transaction updated" : "Transaction created")
    } catch {
      /* api helper toasts */
    }
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this transaction?")) return
    try {
      await api.delete(`/api/transactions/${id}`)
      invalidateCachePrefix("transactions:")
      invalidateCache(
        "dashboard:reports/profit_and_loss",
        "dashboard:reports/cashflow",
      )
      refetchTxns()
    } catch {}
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card className="flex flex-1 min-h-0 flex-col">
        <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2 sm:contents">
            <CardTitle>Transactions</CardTitle>
            <div className="flex items-center gap-2 sm:hidden">
              <Button
                intent="outline"
                size="sm"
                onPress={() => setShowFilters((s) => !s)}
                aria-expanded={showFilters}
              >
                {showFilters ? "Hide" : "Filters"}
              </Button>
              <Button size="sm" onPress={newTxn}>
                <IconPlus />
              </Button>
            </div>
          </div>
          <div
            className={
              "flex flex-wrap items-center gap-2.5 w-full sm:w-auto " +
              (showFilters ? "flex" : "hidden sm:flex")
            }
          >
            <SearchField
              aria-label="Search"
              value={q}
              onChange={setQ}
              className="w-full sm:w-56"
            >
              <SearchInput placeholder="Search..." />
            </SearchField>
            <Select
              aria-label="Type"
              selectedKey={type}
              onSelectionChange={(k) => setType(String(k))}
              className="w-full sm:w-[160px]"
            >
              <SelectTrigger />
              <SelectContent>
                <SelectItem id="all">All Types</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} id={t}>
                    {titleCase(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex w-full items-center gap-1 sm:w-auto">
              <DateRangePicker
                aria-label="Date range"
                className="w-full sm:w-[280px]"
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
                <DateRangePickerTrigger />
              </DateRangePicker>
              {(from || to) && (
                <Button
                  intent="plain"
                  size="sq-sm"
                  aria-label="Clear date range"
                  onPress={() => {
                    setFrom("")
                    setTo("")
                  }}
                >
                  <IconX />
                </Button>
              )}
            </div>
            <Button onPress={newTxn} className="hidden sm:inline-flex">
              <IconPlus /> New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0 [&_table]:min-w-[720px]">
          <Table
            allowResize
            aria-label="Transactions"
            sortDescriptor={sortDescriptor}
            onSortChange={(d) => setSortDescriptor(d as SortDesc)}
            className="[&_th:first-child]:ps-4 [&_td:first-child]:ps-4 [&_th:last-child]:pe-4 [&_td:last-child]:pe-4"
          >
            <IntentTableHeader>
              <TableColumn id="date" isRowHeader allowsSorting>
                Date
              </TableColumn>
              <TableColumn id="description" allowsSorting isResizable className="w-full">
                Description
              </TableColumn>
              <TableColumn id="reference" allowsSorting isResizable>
                Reference
              </TableColumn>
              <TableColumn id="transaction_type" allowsSorting>
                Type
              </TableColumn>
              <TableColumn id="amount" allowsSorting>
                Amount
              </TableColumn>
              <TableColumn id="actions" width={56} minWidth={56} maxWidth={56}>
                {""}
              </TableColumn>
            </IntentTableHeader>
            <TableBody
              items={rows}
              renderEmptyState={() => (
                <div className="p-8 text-center text-sm text-muted-fg">
                  {loading ? "Loading…" : "No transactions."}
                </div>
              )}
            >
              {(t) => {
                const txnType = (t as any).transaction_type ?? t.transactionType
                return (
                  <TableRow id={t.id} onAction={() => editTxn(t)}>
                    <TableCell className="font-mono text-xs">{t.date}</TableCell>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell className="text-muted-fg">{t.reference}</TableCell>
                    <TableCell>
                      <Badge intent={TYPE_INTENT[txnType] ?? "primary"}>
                        {titleCase(txnType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(Number(t.amount))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Menu>
                          <MenuTrigger className="size-6">
                            <EllipsisVerticalIcon />
                          </MenuTrigger>
                          <MenuContent aria-label="Actions" placement="left top">
                            <MenuItem onAction={() => editTxn(t)}>Edit</MenuItem>
                            <MenuSeparator />
                            <MenuItem
                              intent="danger"
                              onAction={() => remove(t.id)}
                            >
                              Delete
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ModalContent
        size="3xl"
        isOpen={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) resetForms()
        }}
      >
          <ModalHeader>
            <ModalTitle>
              {editingId ? "Edit Transaction" : "Add Transaction"}
            </ModalTitle>
          </ModalHeader>
          <ModalBody>
            <Tabs
              selectedKey={tab}
              onSelectionChange={(k) => setTab(k as "simple" | "journal")}
              aria-label="Transaction type"
              className="mb-4"
            >
              <TabList>
                <Tab id="simple">Deposit / Withdrawal</Tab>
                <Tab id="journal">Journal Entry</Tab>
              </TabList>
            </Tabs>
            {tab === "simple" ? (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DatePicker
                    value={simple.date ? parseDate(simple.date) : null}
                    onChange={(d) =>
                      setSimple({ ...simple, date: d ? d.toString() : "" })
                    }
                  >
                    <Label>Date</Label>
                    <DatePickerTrigger />
                  </DatePicker>
                  <TextField
                    value={simple.reference}
                    onChange={(v) => setSimple({ ...simple, reference: v })}
                  >
                    <Label>Reference</Label>
                    <Input placeholder="Optional" />
                  </TextField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Type</Label>
                    <Select
                      aria-label="Kind"
                      selectedKey={simple.kind}
                      onSelectionChange={(k) =>
                        setSimple({ ...simple, kind: k as SimpleKind })
                      }
                    >
                      <SelectTrigger />
                      <SelectContent>
                        <SelectItem id="deposit">Deposit</SelectItem>
                        <SelectItem id="withdrawal">Withdrawal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Account</Label>
                    <Select
                      aria-label="Account"
                      selectedKey={
                        simple.account_id ? String(simple.account_id) : undefined
                      }
                      onSelectionChange={(k) =>
                        setSimple({ ...simple, account_id: Number(k) })
                      }
                    >
                      <SelectTrigger />
                      <SelectContent>
                        {cashAccounts.map((a) => (
                          <SelectItem key={a.id} id={String(a.id)}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    value={String(simple.amount || "")}
                    onChange={(v) =>
                      setSimple({ ...simple, amount: Number(v) || 0 })
                    }
                  >
                    <Label>Amount</Label>
                    <Input type="number" inputMode="decimal" step="0.01" />
                  </TextField>
                  <div className="grid gap-1.5">
                    <Label>Category</Label>
                    <Select
                      aria-label="Category"
                      selectedKey={
                        simple.category_id
                          ? String(simple.category_id)
                          : undefined
                      }
                      onSelectionChange={(k) =>
                        setSimple({ ...simple, category_id: Number(k) })
                      }
                    >
                      <SelectTrigger />
                      <SelectContent>
                        {(simple.kind === "deposit"
                          ? incomeAccounts
                          : expenseAccounts
                        ).map((a) => (
                          <SelectItem key={a.id} id={String(a.id)}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <TextField
                  value={simple.description}
                  onChange={(v) => setSimple({ ...simple, description: v })}
                >
                  <Label>Description</Label>
                  <Input placeholder="Write a description" />
                </TextField>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DatePicker
                    value={journal.date ? parseDate(journal.date) : null}
                    onChange={(d) =>
                      setJournal({ ...journal, date: d ? d.toString() : "" })
                    }
                  >
                    <Label>Date</Label>
                    <DatePickerTrigger />
                  </DatePicker>
                  <TextField
                    value={journal.reference}
                    onChange={(v) => setJournal({ ...journal, reference: v })}
                  >
                    <Label>Reference</Label>
                    <Input placeholder="Optional" />
                  </TextField>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Journal Lines</Label>
                    <Button intent="outline" size="sm" onPress={addLine}>
                      <IconPlus /> Add line
                    </Button>
                  </div>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="p-2 text-left">Memo</th>
                          <th className="p-2 text-left">Account</th>
                          <th className="p-2 text-right">Debit</th>
                          <th className="p-2 text-right">Credit</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {journal.lines.map((l, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">
                              <TextField
                                value={l.memo ?? ""}
                                onChange={(v) => updateLine(i, { memo: v })}
                                aria-label="memo"
                              >
                                <Input placeholder="memo" />
                              </TextField>
                            </td>
                            <td className="p-2">
                              <Select
                                aria-label="Account"
                                selectedKey={
                                  l.account_id
                                    ? String(l.account_id)
                                    : undefined
                                }
                                onSelectionChange={(k) =>
                                  updateLine(i, { account_id: Number(k) })
                                }
                              >
                                <SelectTrigger />
                                <SelectContent>
                                  {accounts.map((a) => (
                                    <SelectItem key={a.id} id={String(a.id)}>
                                      {a.code} — {a.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <TextField
                                value={String(l.debit || "")}
                                onChange={(v) =>
                                  updateLine(i, { debit: Number(v) || 0 })
                                }
                                aria-label="Debit"
                              >
                                <Input
                                  type="number"
                                  step="0.01"
                                  inputMode="decimal"
                                  className="text-right"
                                />
                              </TextField>
                            </td>
                            <td className="p-2">
                              <TextField
                                value={String(l.credit || "")}
                                onChange={(v) =>
                                  updateLine(i, { credit: Number(v) || 0 })
                                }
                                aria-label="Credit"
                              >
                                <Input
                                  type="number"
                                  step="0.01"
                                  inputMode="decimal"
                                  className="text-right"
                                />
                              </TextField>
                            </td>
                            <td className="p-2">
                              <Button
                                intent="plain"
                                size="sq-sm"
                                onPress={() => removeLine(i)}
                              >
                                <IconTrash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="ml-auto rounded-md border bg-muted/30 px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div className="text-muted-fg">Total debits</div>
                  <div className="text-muted-fg text-right">Total credits</div>
                  <div className="font-semibold tabular-nums">
                    {fmtMoney(journalTotals.debit)}
                  </div>
                  <div className="font-semibold tabular-nums text-right">
                    {fmtMoney(journalTotals.credit)}
                  </div>
                  <div className="text-muted-fg">Difference</div>
                  <div
                    className={
                      "text-right tabular-nums " +
                      (journalTotals.balanced
                        ? "text-emerald-500"
                        : "text-danger")
                    }
                  >
                    {fmtMoney(journalTotals.diff)}
                  </div>
                </div>
                <TextField
                  value={journal.description}
                  onChange={(v) => setJournal({ ...journal, description: v })}
                >
                  <Label>Description</Label>
                  <Input placeholder="Write a description" />
                </TextField>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="pt-4 sm:pt-3">
            <Button
              intent="outline"
              onPress={() => setOpen(false)}
              className="hidden sm:inline-flex"
            >
              Cancel
            </Button>
            <Button onPress={save}>Save</Button>
          </ModalFooter>
      </ModalContent>
    </div>
  )
}

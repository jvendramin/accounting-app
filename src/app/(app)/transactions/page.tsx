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
  ComboBox,
  ComboBoxContent,
  ComboBoxInput,
  ComboBoxItem,
} from "@/components/ui/combo-box"
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
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "@/components/chain-of-thought"
import { SparklesIcon } from "@heroicons/react/24/outline"
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
import { BulkActionsBar, selectedIds } from "@/components/bulk-actions-bar"
import { NumberField, NumberInput } from "@/components/ui/number-field"
import { CurrencyDollarIcon } from "@heroicons/react/20/solid"
import type { Selection } from "react-aria-components"
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
  tax_ids?: number[]
}

type TaxRow = { id: number; name: string; rate: number; is_active: boolean }
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
  const { data: taxesData } = useCachedFetch<TaxRow[]>(
    "taxes:all",
    () => api.get("/api/taxes"),
  )
  const activeTaxes = useMemo(
    () => (taxesData ?? []).filter((t) => t.is_active),
    [taxesData],
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
  const [aiReason, setAiReason] = useState<{
    summary: string
    steps: string[]
  } | null>(null)
  // Drafts UI
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [drafts, setDrafts] = useState<
    Array<{ id: number; name: string; payload: any; updated_at: string }>
  >([])
  const reloadDrafts = () =>
    api
      .get<typeof drafts>("/api/drafts")
      .then(setDrafts)
      .catch(() => {})
  // Load on page mount so the header button shows the count.
  useEffect(() => {
    reloadDrafts()
  }, [])

  // Close-confirm prompt: shown when the user tries to dismiss the modal
  // with unsaved progress. Choices: save as draft, or discard.
  const [closePrompt, setClosePrompt] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  // The draft id (if any) the current modal session was resumed from. Cleared
  // on reset/new; on successful save we delete this row so drafts don't
  // linger as duplicates of real transactions.
  const [resumedDraftId, setResumedDraftId] = useState<number | null>(null)

  // Auto-open the create modal when arrived via ?new=1 (from Dashboard quick-create).
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const go = () => {
        resetForms()
        setOpen(true)
      }
      router.replace(pathname)
      go()
    } else if (searchParams.get("from-receipt") === "1") {
      const raw = sessionStorage.getItem("receipt-prefill")
      sessionStorage.removeItem("receipt-prefill")
      const apply = () => {
        if (!raw) return
        try {
          const r = JSON.parse(raw) as {
            description?: string
            reference?: string | null
            amount?: number
            date?: string
            account_id?: number | null
            category_id?: number | null
            reasoning_summary?: string | null
            reasoning_steps?: string[] | null
          }
          setEditingId(null)
          setTab("simple")
          setSimple({
            date: r.date || today(),
            description: r.description ?? "",
            reference: r.reference ?? "",
            kind: "withdrawal",
            amount: Number(r.amount) || 0,
            account_id: r.account_id ?? undefined,
            category_id: r.category_id ?? undefined,
          })
          setAiReason(
            r.reasoning_summary || (r.reasoning_steps && r.reasoning_steps.length)
              ? {
                  summary: r.reasoning_summary ?? "",
                  steps: r.reasoning_steps ?? [],
                }
              : null,
          )
          setOpen(true)
        } catch {}
      }
      router.replace(pathname)
      apply()
    } else if (searchParams.get("clone") === "1") {
      const raw = sessionStorage.getItem("clone-tx")
      sessionStorage.removeItem("clone-tx")
      const apply = () => {
        if (!raw) return
        try {
          const src = JSON.parse(raw) as Txn
          setEditingId(null) // not editing — creating
          const today_ = today()
          const txnType =
            (src as any).transaction_type ?? src.transactionType
          if (txnType === "journal_entry" || src.journal_lines.length !== 2) {
            setTab("journal")
            setJournal({
              date: today_,
              description: src.description,
              reference: src.reference ?? "",
              lines: src.journal_lines.map((l) => ({
                account_id: l.account_id,
                debit: Number(l.debit),
                credit: Number(l.credit),
                memo: l.memo ?? "",
              })),
            })
          } else {
            const debitLine = src.journal_lines.find((l) => Number(l.debit) > 0)
            const creditLine = src.journal_lines.find((l) => Number(l.credit) > 0)
            const kind: SimpleKind =
              txnType === "withdrawal" ? "withdrawal" : "deposit"
            const accountLine = kind === "deposit" ? debitLine : creditLine
            const categoryLine = kind === "deposit" ? creditLine : debitLine
            setTab("simple")
            setSimple({
              date: today_,
              description: src.description,
              reference: src.reference ?? "",
              kind,
              amount: Number(src.amount),
              account_id: accountLine?.account_id,
              category_id: categoryLine?.account_id,
            })
          }
          setOpen(true)
        } catch {
          /* ignore */
        }
      }
      router.replace(pathname)
      apply()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  const [tab, setTab] = useState<"simple" | "journal">("simple")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selection, setSelection] = useState<Selection>(new Set())
  const bulkDelete = async () => {
    const ids = selectedIds(selection, rows)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} transaction${ids.length > 1 ? "s" : ""}?`))
      return
    try {
      await api.post("/api/transactions/bulk_destroy", { ids })
      setSelection(new Set())
      invalidateCachePrefix("transactions:")
      invalidateCache(
        "dashboard:reports/profit_and_loss",
        "dashboard:reports/cashflow",
        "dashboard:suggestions",
      )
      refetchTxns()
      toast.success(`Deleted ${ids.length}`)
    } catch {
      /* toasted */
    }
  }
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

  // ---- Autosave to localStorage ----
  const snapshotForm = () => ({ tab, simple, journal, editingId })
  const loadSnapshot = (s: any) => {
    if (!s || typeof s !== "object") {
      toast.error("This draft is malformed and can't be resumed")
      return false
    }
    const emptySimple: SimpleForm = {
      date: today(),
      description: "",
      reference: "",
      kind: "deposit",
      amount: 0,
    }
    const emptyJournal: JournalForm = {
      date: today(),
      description: "",
      reference: "",
      lines: [
        { account_id: undefined, debit: 0, credit: 0, memo: "" },
        { account_id: undefined, debit: 0, credit: 0, memo: "" },
      ],
    }
    setTab(s.tab === "journal" ? "journal" : "simple")
    setSimple({ ...emptySimple, ...(s.simple || {}) })
    setJournal({
      ...emptyJournal,
      ...(s.journal || {}),
      lines: Array.isArray(s.journal?.lines) && s.journal.lines.length > 0
        ? s.journal.lines
        : emptyJournal.lines,
    })
    setEditingId(s.editingId ?? null)
    return true
  }
  // Whether the in-memory form has anything worth offering as a draft on close.
  const hasUnsavedProgress = () => {
    const s = simple
    const j = journal
    const simpleDirty =
      !!s.description ||
      !!s.reference ||
      (s.amount ?? 0) > 0 ||
      s.account_id !== undefined ||
      s.category_id !== undefined ||
      (s.tax_ids?.length ?? 0) > 0
    const journalDirty =
      !!j.description ||
      !!j.reference ||
      j.lines.some(
        (l) => l.account_id || Number(l.debit) || Number(l.credit) || l.memo,
      )
    return tab === "simple" ? simpleDirty : journalDirty
  }

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
    setResumedDraftId(null)
  }
  const newTxn = () => {
    resetForms()
    setOpen(true)
  }

  const discardAndClose = () => {
    setOpen(false)
    setClosePrompt(false)
    resetForms()
    setAiReason(null)
  }
  const saveAsDraft = async () => {
    const name =
      (tab === "simple" ? simple.description : journal.description) ||
      `Draft ${new Date().toLocaleString()}`
    setSavingDraft(true)
    try {
      if (resumedDraftId !== null) {
        await api.put(`/api/drafts/${resumedDraftId}`, {
          draft: { name, payload: snapshotForm() },
        })
      } else {
        await api.post("/api/drafts", {
          draft: { name, payload: snapshotForm() },
        })
      }
      toast.success("Saved as draft")
      reloadDrafts()
      setOpen(false)
      setClosePrompt(false)
      resetForms()
      setAiReason(null)
    } catch {
      /* toasted */
    } finally {
      setSavingDraft(false)
    }
  }
  const attemptClose = () => {
    if (hasUnsavedProgress()) setClosePrompt(true)
    else discardAndClose()
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
        tax_ids: (t as any).tax_ids ?? [],
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
          tax_ids: simple.tax_ids ?? [],
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
      if (resumedDraftId !== null) {
        try { await api.delete(`/api/drafts/${resumedDraftId}`) } catch {}
        reloadDrafts()
      }
      resetForms()
      invalidateCachePrefix("transactions:")
      invalidateCache(
        "dashboard:reports/profit_and_loss",
        "dashboard:reports/cashflow",
        "dashboard:suggestions",
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
        "dashboard:suggestions",
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
              {drafts.length > 0 && (
                <Button
                  intent="outline"
                  size="sm"
                  onPress={() => {
                    reloadDrafts()
                    setDraftsOpen(true)
                  }}
                >
                  Drafts ({drafts.length})
                </Button>
              )}
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
            <ComboBox
              aria-label="Type"
              selectedKey={type}
              onSelectionChange={(k) => setType(k == null ? "all" : String(k))}
              className="w-full sm:w-[160px]"
            >
              <ComboBoxInput placeholder="All Types" />
              <ComboBoxContent>
                <ComboBoxItem id="all">All Types</ComboBoxItem>
                {TYPES.map((t) => (
                  <ComboBoxItem key={t} id={t} textValue={titleCase(t)}>
                    {titleCase(t)}
                  </ComboBoxItem>
                ))}
              </ComboBoxContent>
            </ComboBox>
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
            <Button
              intent="outline"
              onPress={() => {
                reloadDrafts()
                setDraftsOpen(true)
              }}
              className="hidden sm:inline-flex"
            >
              Drafts {drafts.length > 0 ? `(${drafts.length})` : ""}
            </Button>
            <Button onPress={newTxn} className="hidden sm:inline-flex">
              <IconPlus /> New
            </Button>
          </div>
        </CardHeader>
        <CardContent
          className="flex-1 overflow-auto px-4 py-0 [&_table]:min-w-[720px]"
          style={{ "--gutter": "1rem" } as React.CSSProperties}
        >
          <BulkActionsBar
            selection={selection}
            totalRows={rows.length}
            onClear={() => setSelection(new Set())}
            onDelete={bulkDelete}
          />
          <Table
            allowResize
            aria-label="Transactions"
            selectionMode="multiple"
            selectedKeys={selection}
            onSelectionChange={(keys) =>
              setSelection(keys)
            }
            sortDescriptor={sortDescriptor}
            onSortChange={(d) => setSortDescriptor(d as SortDesc)}
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
          if (v) {
            setOpen(true)
            return
          }
          if (hasUnsavedProgress()) {
            setClosePrompt(true)
          } else {
            setOpen(false)
            resetForms()
            setAiReason(null)
          }
        }}
      >
          <ModalHeader>
            <ModalTitle>
              {editingId ? "Edit Transaction" : "Add Transaction"}
            </ModalTitle>
          </ModalHeader>
          <ModalBody>
            {aiReason && (
              <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                  <SparklesIcon className="size-3.5" />
                  AI suggestion
                </div>
                <p className="mb-2 text-sm font-medium text-fg">
                  {aiReason.summary}
                </p>
                {aiReason.steps.length > 0 && (
                  <ChainOfThought>
                    {aiReason.steps.map((step, i) => {
                      const [head, ...rest] = step.split(":")
                      const detail = rest.join(":").trim()
                      return (
                        <ChainOfThoughtStep key={i} defaultOpen={i === 0}>
                          <ChainOfThoughtTrigger>
                            {head.trim()}
                          </ChainOfThoughtTrigger>
                          {detail && (
                            <ChainOfThoughtContent>
                              <ChainOfThoughtItem>{detail}</ChainOfThoughtItem>
                            </ChainOfThoughtContent>
                          )}
                        </ChainOfThoughtStep>
                      )
                    })}
                  </ChainOfThought>
                )}
              </div>
            )}
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
                  <ComboBox
                    aria-label="Type"
                    selectedKey={simple.kind}
                    onSelectionChange={(k) =>
                      k && setSimple({ ...simple, kind: k as SimpleKind })
                    }
                  >
                    <Label>Type</Label>
                    <ComboBoxInput placeholder="Select type" />
                    <ComboBoxContent>
                      <ComboBoxItem id="deposit">Deposit</ComboBoxItem>
                      <ComboBoxItem id="withdrawal">Withdrawal</ComboBoxItem>
                    </ComboBoxContent>
                  </ComboBox>
                  <ComboBox
                    aria-label="Account"
                    selectedKey={simple.account_id ?? null}
                    onSelectionChange={(k) =>
                      setSimple({
                        ...simple,
                        account_id: k == null ? undefined : Number(k),
                      })
                    }
                  >
                    <Label>Account</Label>
                    <ComboBoxInput placeholder="Select account" />
                    <ComboBoxContent items={cashAccounts}>
                      {(a) => (
                        <ComboBoxItem
                          id={a.id}
                          textValue={`${a.code} — ${a.name}`}
                        >
                          {`${a.code} — ${a.name}`}
                        </ComboBoxItem>
                      )}
                    </ComboBoxContent>
                  </ComboBox>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    value={simple.amount}
                    onChange={(v) =>
                      setSimple({
                        ...simple,
                        amount: Number.isFinite(v) ? v : 0,
                      })
                    }
                    minValue={0}
                    step={0.01}
                    formatOptions={{
                      style: "decimal",
                      minimumFractionDigits: 2,
                    }}
                  >
                    <Label>Amount</Label>
                    <NumberInput leading={<CurrencyDollarIcon />} />
                  </NumberField>
                  <ComboBox
                    aria-label="Category"
                    selectedKey={simple.category_id ?? null}
                    onSelectionChange={(k) =>
                      setSimple({
                        ...simple,
                        category_id: k == null ? undefined : Number(k),
                      })
                    }
                  >
                    <Label>Category</Label>
                    <ComboBoxInput placeholder="Select category" />
                    <ComboBoxContent
                      items={
                        simple.kind === "deposit"
                          ? incomeAccounts
                          : expenseAccounts
                      }
                    >
                      {(a) => (
                        <ComboBoxItem
                          id={a.id}
                          textValue={`${a.code} — ${a.name}`}
                        >
                          {`${a.code} — ${a.name}`}
                        </ComboBoxItem>
                      )}
                    </ComboBoxContent>
                  </ComboBox>
                </div>
                <TextField
                  value={simple.description}
                  onChange={(v) => setSimple({ ...simple, description: v })}
                >
                  <Label>Description</Label>
                  <Input placeholder="Write a description" />
                </TextField>
                {activeTaxes.length > 0 && (
                  <div className="grid gap-2">
                    <Label>Taxes (inclusive in total)</Label>
                    <div className="flex flex-wrap gap-2">
                      {activeTaxes.map((t) => {
                        const selected = simple.tax_ids?.includes(t.id) ?? false
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              setSimple({
                                ...simple,
                                tax_ids: selected
                                  ? (simple.tax_ids ?? []).filter(
                                      (i) => i !== t.id,
                                    )
                                  : [...(simple.tax_ids ?? []), t.id],
                              })
                            }
                            className={
                              "rounded-full border px-3 py-1 text-xs transition " +
                              (selected
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border hover:border-fg/30")
                            }
                          >
                            {t.name} {(t.rate * 100).toFixed(2)}%
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {simple.amount > 0 && (() => {
                  const selected = activeTaxes.filter((t) =>
                    (simple.tax_ids ?? []).includes(t.id),
                  )
                  const sumRates = selected.reduce(
                    (s, t) => s + Number(t.rate),
                    0,
                  )
                  const net =
                    sumRates > 0 ? simple.amount / (1 + sumRates) : simple.amount
                  return (
                    <div className="ml-auto rounded-md border bg-muted/30 px-4 py-3 text-sm grid gap-1 min-w-[14rem]">
                      {selected.length > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-fg">Net (excl. tax)</span>
                            <span className="font-mono tabular-nums">
                              {fmtMoney(+net.toFixed(2))}
                            </span>
                          </div>
                          {selected.map((t) => (
                            <div
                              key={t.id}
                              className="flex justify-between text-muted-fg"
                            >
                              <span>
                                {t.name} {(t.rate * 100).toFixed(2)}%
                              </span>
                              <span className="font-mono tabular-nums">
                                {fmtMoney(+(net * Number(t.rate)).toFixed(2))}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                      <div
                        className={
                          "flex justify-between font-semibold " +
                          (selected.length > 0 ? "border-t pt-1" : "")
                        }
                      >
                        <span>Grand total</span>
                        <span className="font-mono tabular-nums">
                          {fmtMoney(simple.amount)}
                        </span>
                      </div>
                    </div>
                  )
                })()}
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
                              <ComboBox
                                aria-label="Account"
                                selectedKey={l.account_id ?? null}
                                onSelectionChange={(k) =>
                                  updateLine(i, {
                                    account_id:
                                      k == null ? undefined : Number(k),
                                  })
                                }
                              >
                                <ComboBoxInput placeholder="Select" />
                                <ComboBoxContent items={accounts}>
                                  {(a) => (
                                    <ComboBoxItem
                                      id={a.id}
                                      textValue={`${a.code} — ${a.name}`}
                                    >
                                      {`${a.code} — ${a.name}`}
                                    </ComboBoxItem>
                                  )}
                                </ComboBoxContent>
                              </ComboBox>
                            </td>
                            <td className="p-2">
                              <NumberField
                                value={Number(l.debit) || 0}
                                onChange={(v) =>
                                  updateLine(i, {
                                    debit: Number.isFinite(v) ? v : 0,
                                  })
                                }
                                minValue={0}
                                step={0.01}
                                formatOptions={{
                                  style: "decimal",
                                  minimumFractionDigits: 2,
                                }}
                                aria-label="Debit"
                              >
                                <NumberInput
                                  leading={<CurrencyDollarIcon />}
                                  className="text-right"
                                />
                              </NumberField>
                            </td>
                            <td className="p-2">
                              <NumberField
                                value={Number(l.credit) || 0}
                                onChange={(v) =>
                                  updateLine(i, {
                                    credit: Number.isFinite(v) ? v : 0,
                                  })
                                }
                                minValue={0}
                                step={0.01}
                                formatOptions={{
                                  style: "decimal",
                                  minimumFractionDigits: 2,
                                }}
                                aria-label="Credit"
                              >
                                <NumberInput
                                  leading={<CurrencyDollarIcon />}
                                  className="text-right"
                                />
                              </NumberField>
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
              intent="plain"
              onPress={() => {
                reloadDrafts()
                setDraftsOpen(true)
              }}
              className="me-auto hidden sm:inline-flex"
            >
              Drafts…
            </Button>
            <Button
              intent="outline"
              onPress={attemptClose}
              className="hidden sm:inline-flex"
            >
              Cancel
            </Button>
            <Button onPress={save}>Save</Button>
          </ModalFooter>
      </ModalContent>

      {/* Drafts list */}
      <ModalContent
        size="lg"
        isOpen={draftsOpen}
        onOpenChange={setDraftsOpen}
      >
        <ModalHeader>
          <ModalTitle>Drafts</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {drafts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-fg">
              No drafts saved.
            </div>
          ) : (
            <ul className="grid gap-2">
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="text-xs text-muted-fg">
                      {new Date(d.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    intent="outline"
                    size="sm"
                    onPress={() => {
                      try {
                        if (loadSnapshot(d.payload)) {
                          setResumedDraftId(d.id)
                          setDraftsOpen(false)
                          setOpen(true)
                        }
                      } catch {
                        toast.error("Couldn't load this draft")
                      }
                    }}
                  >
                    Resume
                  </Button>
                  <Button
                    intent="plain"
                    size="sq-sm"
                    aria-label="Delete draft"
                    onPress={async () => {
                      await api.delete(`/api/drafts/${d.id}`)
                      reloadDrafts()
                    }}
                  >
                    <IconTrash />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ModalBody>
      </ModalContent>

      {/* Close-confirm: save as draft or discard */}
      <ModalContent
        size="md"
        role="alertdialog"
        isDismissable
        isOpen={closePrompt}
        onOpenChange={(v) => {
          if (!v) setClosePrompt(false)
        }}
      >
        <ModalHeader>
          <ModalTitle>Save as draft?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm">
            You have unsaved progress on this transaction. Save it as a draft
            to resume later, or discard your changes.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button intent="danger" onPress={discardAndClose}>
            Discard
          </Button>
          <Button onPress={saveAsDraft} isPending={savingDraft}>
            Save as draft
          </Button>
        </ModalFooter>
      </ModalContent>
    </div>
  )
}

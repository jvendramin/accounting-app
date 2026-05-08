"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuTrigger,
} from "@/components/ui/menu"
import { BarChart } from "@/components/ui/bar-chart"
import { LineChart } from "@/components/ui/line-chart"
import {
  IconArrowLeftRight,
  IconBookOpen,
  IconReceipt,
  IconPlus,
  IconTag,
} from "@/components/icons"
import { useRouter } from "next/navigation"
import {
  invalidateCache,
  invalidateCachePrefix,
  useCachedFetch,
} from "@/hooks/use-cached-fetch"
import { api } from "@/lib/api"
import { fmtMoney, titleCase } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { TableBody } from "react-aria-components"
import {
  Table,
  TableCell,
  TableColumn,
  TableHeader as IntentTableHeader,
  TableRow,
} from "@/components/ui/table"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { QuickCreateModal, type QuickType } from "@/components/quick-create-modal"
import { useState } from "react"
import { toast } from "sonner"
import type { Selection } from "react-aria-components"
import { IconTrash } from "@/components/icons"

type Suggestion = {
  id: number
  date: string
  description: string
  reference: string | null
  transaction_type: string
  amount: number
  occurrences: number
  last_this_month: string | null
  journal_lines: Array<{
    id?: number
    account_id: number
    account_name?: string
    debit: number
    credit: number
    memo?: string | null
  }>
}

const niceDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })

function suggestionReason(s: Suggestion): string {
  if (s.last_this_month) {
    return `Already created this month on ${niceDate(s.last_this_month)}`
  }
  if (s.occurrences >= 3)
    return `Recurring (${s.occurrences}× before) — last on ${niceDate(s.date)}`
  if (s.occurrences === 2) return `Seen twice before — last on ${niceDate(s.date)}`
  return `Same week last month — ${niceDate(s.date)}`
}

type PnL = {
  total_income: number
  total_expense: number
  net_income: number
  monthly: Array<{ month: string; income: number; expense: number; net: number }>
}

type Cash = {
  monthly: Array<{ month: string; net: number; inflow: number; outflow: number }>
}

const formatCompact = (v: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "short" }).format(v)

export default function DashboardPage() {
  const router = useRouter()
  const pnlQ = useCachedFetch<PnL>("dashboard:reports/profit_and_loss", () =>
    api.get("/api/reports/profit_and_loss"),
  )
  const cashQ = useCachedFetch<Cash>("dashboard:reports/cashflow", () =>
    api.get("/api/reports/cashflow"),
  )

  const [quickType, setQuickType] = useState<QuickType>(null)
  const quickCreate = (t: QuickType) => setQuickType(t)
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(
    null,
  )

  const suggestionsQ = useCachedFetch<Suggestion[]>(
    "dashboard:suggestions",
    () => api.get("/api/transactions/suggestions"),
  )
  const suggestions = suggestionsQ.data ?? []

  const cloneSuggestion = (s: Suggestion) => {
    sessionStorage.setItem("clone-tx", JSON.stringify(s))
    router.push("/transactions?clone=1")
  }

  const [selected, setSelected] = useState<Selection>(new Set())
  const selectedIds: number[] =
    selected === "all"
      ? suggestions.map((s) => s.id)
      : Array.from(selected as Set<number | string>).map((k) => Number(k))
  const selectedSuggestions = suggestions.filter((s) =>
    selectedIds.includes(s.id),
  )

  const dismissOne = async (id: number) => {
    try {
      await api.post("/api/transactions/suggestions/dismiss", { ids: [id] })
      invalidateCache("dashboard:suggestions")
      suggestionsQ.refetch()
    } catch {
      /* toasted */
    }
  }

  const bulkDismiss = async () => {
    if (selectedIds.length === 0) return
    try {
      await api.post("/api/transactions/suggestions/dismiss", { ids: selectedIds })
      toast.success(`Dismissed ${selectedIds.length} suggestion(s)`)
      setSelected(new Set())
      invalidateCache("dashboard:suggestions")
      suggestionsQ.refetch()
    } catch {}
  }

  const bulkCreate = async () => {
    if (selectedSuggestions.length === 0) return
    const todayStr = new Date().toISOString().slice(0, 10)
    try {
      await api.post("/api/transactions/bulk_create", {
        transactions: selectedSuggestions.map((s) => ({
          date: todayStr,
          description: s.description,
          reference: s.reference ?? "",
          transaction_type: s.transaction_type,
          amount: s.amount,
          journal_lines_attributes: s.journal_lines.map((l) => ({
            account_id: l.account_id,
            debit: l.debit,
            credit: l.credit,
            memo: l.memo ?? null,
          })),
        })),
      })
      toast.success(`Created ${selectedSuggestions.length} transaction(s)`)
      setSelected(new Set())
      invalidateCachePrefix("transactions:")
      invalidateCache(
        "dashboard:reports/profit_and_loss",
        "dashboard:reports/cashflow",
        "dashboard:suggestions",
      )
      suggestionsQ.refetch()
    } catch {}
  }

  const pnl = pnlQ.data
  const cash = cashQ.data

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-fg">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-end">
        <Menu>
          <MenuTrigger>
            <Button>
              <IconPlus /> Quick create
            </Button>
          </MenuTrigger>
          <MenuContent placement="bottom end" className="min-w-56">
            <MenuItem onAction={() => quickCreate("transaction")}>
              <IconArrowLeftRight />
              <MenuLabel>Transaction</MenuLabel>
            </MenuItem>
            <MenuItem onAction={() => quickCreate("account")}>
              <IconBookOpen />
              <MenuLabel>Account</MenuLabel>
            </MenuItem>
            <MenuItem onAction={() => quickCreate("category")}>
              <IconTag />
              <MenuLabel>Category</MenuLabel>
            </MenuItem>
            <MenuItem onAction={() => router.push("/receipts")}>
              <IconReceipt />
              <MenuLabel>Receipt</MenuLabel>
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Stat
          label="Income (last 12mo)"
          value={fmtMoney(pnl?.total_income ?? 0)}
        />
        <Stat label="Expenses" value={fmtMoney(pnl?.total_expense ?? 0)} />
        <Stat label="Net Income" value={fmtMoney(pnl?.net_income ?? 0)} />
        <div className="grid gap-4 lg:col-span-3 xl:grid-cols-2 lg:order-3">
          <Card>
            <CardHeader>
              <CardTitle>Income vs Expense</CardTitle>
              <CardDescription>
                Monthly totals from journal lines.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                containerHeight={280}
                data={pnl?.monthly ?? []}
                dataKey="month"
                valueFormatter={formatCompact}
                xAxisProps={{ interval: 0 }}
                config={{
                  income: { label: "Income", color: "var(--color-emerald-500)" },
                  expense: { label: "Expense", color: "var(--color-red-500)" },
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cashflow</CardTitle>
              <CardDescription>Net cash movement per month.</CardDescription>
            </CardHeader>
            <CardContent>
              <LineChart
                containerHeight={280}
                data={cash?.monthly ?? []}
                dataKey="month"
                valueFormatter={formatCompact}
                config={{ net: { label: "Net", color: "var(--color-sky-500)" } }}
              />
            </CardContent>
          </Card>
        </div>

      {suggestions.length > 0 && (
        <Card className="lg:row-span-2 lg:order-2 flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle>Recurring this week</CardTitle>
            <CardDescription>
              Transactions from the same week last month — one click to clone.
            </CardDescription>
          </CardHeader>
          <CardContent
            className="flex-1 overflow-auto px-4 py-0 [&_table]:min-w-[420px]"
            style={{ "--gutter": "1rem" } as React.CSSProperties}
          >
            <BulkActionsBar
              selection={selected}
              totalRows={suggestions.length}
              onClear={() => setSelected(new Set())}
              onDelete={selectedIds.length > 0 ? bulkDismiss : null}
              deleteLabel="Dismiss"
              extraActions={
                selectedIds.length > 0
                  ? [
                      {
                        label: "Create all",
                        icon: <IconPlus />,
                        intent: "primary",
                        onPress: bulkCreate,
                      },
                    ]
                  : undefined
              }
            />
            <Table
              allowResize
              aria-label="Suggested recurring transactions"
              selectionMode="multiple"
              selectedKeys={selected}
              onSelectionChange={setSelected}
            >
              <IntentTableHeader>
                <TableColumn id="description" isRowHeader className="w-full">
                  Description
                </TableColumn>
                <TableColumn id="type">Type</TableColumn>
                <TableColumn id="amount">Amount</TableColumn>
              </IntentTableHeader>
              <TableBody items={suggestions}>
                {(s) => (
                  <TableRow
                    id={s.id}
                    onAction={() => setActiveSuggestion(s)}
                  >
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {s.description}
                        </span>
                        <span className="truncate text-xs text-muted-fg">
                          {suggestionReason(s)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge intent="secondary">
                          {titleCase(s.transaction_type)}
                        </Badge>
                        {s.last_this_month && (
                          <Badge intent="success">Done</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {fmtMoney(s.amount)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </div>

      <QuickCreateModal
        type={quickType}
        onClose={() => setQuickType(null)}
      />

      <ModalContent
        size="lg"
        isOpen={activeSuggestion !== null}
        onOpenChange={(v) => {
          if (!v) setActiveSuggestion(null)
        }}
      >
        {activeSuggestion && (
          <>
            <ModalHeader>
              <ModalTitle>{activeSuggestion.description}</ModalTitle>
            </ModalHeader>
            <ModalBody className="grid gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge intent="secondary">
                  {titleCase(activeSuggestion.transaction_type)}
                </Badge>
                {activeSuggestion.last_this_month && (
                  <Badge intent="success">Already created this month</Badge>
                )}
                <Badge intent="warning">
                  {fmtMoney(activeSuggestion.amount)}
                </Badge>
              </div>
              <div className="text-muted-fg">
                {suggestionReason(activeSuggestion)}
              </div>
              {Array.isArray((activeSuggestion as any).journal_lines) &&
                (activeSuggestion as any).journal_lines.length > 0 && (
                  <div className="rounded-md border bg-muted/30">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-fg">
                        <tr>
                          <th className="p-2 text-left font-medium">Account</th>
                          <th className="p-2 text-right font-medium">Debit</th>
                          <th className="p-2 text-right font-medium">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeSuggestion as any).journal_lines.map(
                          (l: any, i: number) => (
                            <tr key={i} className="border-t">
                              <td className="p-2">
                                {l.account_name ?? `#${l.account_id}`}
                              </td>
                              <td className="p-2 text-right tabular-nums">
                                {l.debit > 0 ? fmtMoney(l.debit) : ""}
                              </td>
                              <td className="p-2 text-right tabular-nums">
                                {l.credit > 0 ? fmtMoney(l.credit) : ""}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
            </ModalBody>
            <ModalFooter className="pt-4 sm:pt-3">
              <Button
                intent="danger"
                onPress={() => {
                  const s = activeSuggestion
                  setActiveSuggestion(null)
                  void dismissOne(s.id)
                }}
              >
                <IconTrash /> Dismiss
              </Button>
              <Button
                onPress={() => {
                  const s = activeSuggestion
                  setActiveSuggestion(null)
                  cloneSuggestion(s)
                }}
              >
                <IconPlus /> Clone
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </div>
  )
}

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
import { useCachedFetch } from "@/hooks/use-cached-fetch"
import { api } from "@/lib/api"
import { fmtMoney, titleCase } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { GridList, GridListItem } from "@/components/ui/grid-list"

type Suggestion = {
  id: number
  date: string
  description: string
  reference: string | null
  transaction_type: string
  amount: number
  occurrences: number
  journal_lines: Array<{
    id?: number
    account_id: number
    account_name?: string
    debit: number
    credit: number
    memo?: string | null
  }>
}

function suggestionReason(s: Suggestion): string {
  const niceDate = new Date(`${s.date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
  if (s.occurrences >= 3) return `Recurring (${s.occurrences}× before) — last on ${niceDate}`
  if (s.occurrences === 2) return `Seen twice before — last on ${niceDate}`
  return `Same week last month — ${niceDate}`
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

  const quickCreate = (path: string) => router.push(`${path}?new=1`)

  const suggestionsQ = useCachedFetch<Suggestion[]>(
    "dashboard:suggestions",
    () => api.get("/api/transactions/suggestions"),
  )
  const suggestions = suggestionsQ.data ?? []

  const cloneSuggestion = (s: Suggestion) => {
    sessionStorage.setItem("clone-tx", JSON.stringify(s))
    router.push("/transactions?clone=1")
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
            <MenuItem onAction={() => quickCreate("/transactions")}>
              <IconArrowLeftRight />
              <MenuLabel>Transaction</MenuLabel>
            </MenuItem>
            <MenuItem onAction={() => quickCreate("/accounts")}>
              <IconBookOpen />
              <MenuLabel>Account</MenuLabel>
            </MenuItem>
            <MenuItem onAction={() => quickCreate("/categories")}>
              <IconTag />
              <MenuLabel>Category</MenuLabel>
            </MenuItem>
            <MenuItem onAction={() => quickCreate("/receipts")}>
              <IconReceipt />
              <MenuLabel>Receipt</MenuLabel>
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Income (last 12mo)" value={fmtMoney(pnl?.total_income ?? 0)} />
        <Stat label="Expenses" value={fmtMoney(pnl?.total_expense ?? 0)} />
        <Stat label="Net Income" value={fmtMoney(pnl?.net_income ?? 0)} />
      </div>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recurring this week</CardTitle>
            <CardDescription>
              Transactions from the same week last month — one click to clone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GridList
              aria-label="Suggested recurring transactions"
              items={suggestions}
              selectionMode="none"
            >
              {(s) => (
                <GridListItem
                  id={s.id}
                  textValue={s.description}
                  className="!flex-col !items-stretch !gap-2 sm:!flex-row sm:!items-center sm:!gap-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{s.description}</span>
                      <Badge intent="secondary" className="shrink-0">
                        {titleCase(s.transaction_type)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-fg truncate">
                      {suggestionReason(s)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:contents">
                    <div className="text-right tabular-nums whitespace-nowrap">
                      {fmtMoney(s.amount)}
                    </div>
                    <Button
                      intent="outline"
                      size="sm"
                      onPress={() => cloneSuggestion(s)}
                    >
                      <IconPlus /> Clone
                    </Button>
                  </div>
                </GridListItem>
              )}
            </GridList>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expense</CardTitle>
            <CardDescription>Monthly totals from journal lines.</CardDescription>
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
              config={{
                net: { label: "Net", color: "var(--color-sky-500)" },
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

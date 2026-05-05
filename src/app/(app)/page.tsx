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
import { fmtMoney } from "@/lib/format"

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

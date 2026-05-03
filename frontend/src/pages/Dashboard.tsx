import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { withMinDelay } from "@/lib/loading"
import { fmtMoney } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis,
} from "recharts"

type PnL = {
  total_income: number; total_expense: number; net_income: number
  monthly: Array<{ month: string; income: number; expense: number; net: number }>
}

export default function Dashboard() {
  const [pnl, setPnl] = useState<PnL | null>(null)
  const [cash, setCash] = useState<{ monthly: Array<{ month: string; net: number; inflow: number; outflow: number }> } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      withMinDelay(api.get("/reports/profit_and_loss"), 1000),
      withMinDelay(api.get("/reports/cashflow"), 1000),
    ])
      .then(([p, c]) => { setPnl(p.data); setCash(c.data) })
      .finally(() => setLoading(false))
  }, [])

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="text-2xl font-semibold">
        {loading ? <Skeleton className="h-7 w-32" /> : value}
      </CardContent>
    </Card>
  )

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Income (last 12mo)" value={fmtMoney(pnl?.total_income ?? 0)} />
        <Stat label="Expenses" value={fmtMoney(pnl?.total_expense ?? 0)} />
        <Stat label="Net Income" value={fmtMoney(pnl?.net_income ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Income vs Expense</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[280px] w-full" /> : (
              <ChartContainer
                config={{
                  income: { label: "Income", color: "var(--chart-1)" },
                  expense: { label: "Expense", color: "var(--chart-2)" },
                }}
                className="h-[280px] w-full"
              >
                <BarChart data={pnl?.monthly ?? []}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="income" fill="var(--color-income)" radius={4} />
                  <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cashflow</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[280px] w-full" /> : (
              <ChartContainer
                config={{ net: { label: "Net Cash", color: "var(--chart-3)" } }}
                className="h-[280px] w-full"
              >
                <LineChart data={cash?.monthly ?? []}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

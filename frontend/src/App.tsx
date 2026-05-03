import { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { AuthGate } from "@/components/auth-gate"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import Dashboard from "@/pages/Dashboard"
import Transactions from "@/pages/Transactions"
import Accounts from "@/pages/Accounts"
import Receipts from "@/pages/Receipts"

// Heavy / less-frequently-visited pages — split into their own chunks so the
// initial bundle stays small. Recharts (used by all three Reports pages) is
// ~280KB gzipped on its own and shouldn't ship with the entry chunk.
const ImportPage = lazy(() => import("@/pages/Import"))
const ReportsPnL = lazy(() => import("@/pages/ReportsPnL"))
const ReportsBalanceSheet = lazy(() => import("@/pages/ReportsBalanceSheet"))
const ReportsCashflow = lazy(() => import("@/pages/ReportsCashflow"))

const RouteFallback = () => <div className="h-full" />

export function App() {
  return (
    <TooltipProvider>
      <AuthGate>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="receipts" element={<Receipts />} />
              <Route
                path="import"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <ImportPage />
                  </Suspense>
                }
              />
              <Route
                path="reports/pnl"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <ReportsPnL />
                  </Suspense>
                }
              />
              <Route
                path="reports/balance-sheet"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <ReportsBalanceSheet />
                  </Suspense>
                }
              />
              <Route
                path="reports/cashflow"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <ReportsCashflow />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthGate>
      <Toaster />
    </TooltipProvider>
  )
}

export default App

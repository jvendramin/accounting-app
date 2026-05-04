import { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { AuthGate } from "@/components/auth-gate"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import Transactions from "@/pages/Transactions"
import Accounts from "@/pages/Accounts"

// All chart- and file-upload-heavy pages are lazy so the entry bundle stays
// tiny and mobile devices don't choke parsing recharts/filepond on first
// load. Recharts is ~300KB and FilePond is ~130KB on their own.
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const Receipts = lazy(() => import("@/pages/Receipts"))
const ImportPage = lazy(() => import("@/pages/Import"))
const ReportsPnL = lazy(() => import("@/pages/ReportsPnL"))
const ReportsBalanceSheet = lazy(() => import("@/pages/ReportsBalanceSheet"))
const ReportsCashflow = lazy(() => import("@/pages/ReportsCashflow"))

const RouteFallback = () => <div className="h-full" />

const lazyRoute = (node: React.ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{node}</Suspense>
)

export function App() {
  return (
    <TooltipProvider>
      <AuthGate>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={lazyRoute(<Dashboard />)} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="receipts" element={lazyRoute(<Receipts />)} />
              <Route path="import" element={lazyRoute(<ImportPage />)} />
              <Route path="reports/pnl" element={lazyRoute(<ReportsPnL />)} />
              <Route
                path="reports/balance-sheet"
                element={lazyRoute(<ReportsBalanceSheet />)}
              />
              <Route
                path="reports/cashflow"
                element={lazyRoute(<ReportsCashflow />)}
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

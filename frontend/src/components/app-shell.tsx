import { Outlet, useLocation } from "react-router-dom"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AppSidebar } from "@/components/app-sidebar"

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/transactions": "Transactions",
  "/accounts": "Chart of Accounts",
  "/receipts": "Receipts",
  "/import": "Import",
  "/reports/pnl": "Profit & Loss",
  "/reports/balance-sheet": "Balance Sheet",
  "/reports/cashflow": "Cashflow",
}

export function AppShell() {
  const { pathname } = useLocation()
  const title = titles[pathname] ?? "Books"
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium">{title}</h1>
        </header>
        <main className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

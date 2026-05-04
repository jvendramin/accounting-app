"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarItem,
  SidebarLabel,
  SidebarProvider,
  SidebarRail,
  SidebarSection,
  SidebarSectionGroup,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { auth } from "@/lib/auth"
import {
  IconCircleQuestionmark,
  IconChartBar,
  IconHome,
  IconReceipt,
  IconUpload,
  IconWallet,
  IconBookOpen,
  IconArrowLeftRight,
  IconLogout,
} from "@/components/icons"
import { usePathname } from "next/navigation"

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = titles[pathname] ?? "Books"
  const session = auth.useSession()
  const user = session.data?.user

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarLabel className="font-semibold">Books</SidebarLabel>
        </SidebarHeader>
        <SidebarContent>
          <SidebarSectionGroup>
            <SidebarSection title="Workspace">
              <SidebarItem href="/" isCurrent={pathname === "/"}>
                <IconHome />
                <SidebarLabel>Dashboard</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/transactions"
                isCurrent={pathname === "/transactions"}
              >
                <IconArrowLeftRight />
                <SidebarLabel>Transactions</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/accounts"
                isCurrent={pathname === "/accounts"}
              >
                <IconBookOpen />
                <SidebarLabel>Chart of Accounts</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/receipts"
                isCurrent={pathname === "/receipts"}
              >
                <IconReceipt />
                <SidebarLabel>Receipts</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/import" isCurrent={pathname === "/import"}>
                <IconUpload />
                <SidebarLabel>Import</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
            <SidebarSection title="Reports">
              <SidebarItem
                href="/reports/pnl"
                isCurrent={pathname === "/reports/pnl"}
              >
                <IconChartBar />
                <SidebarLabel>Profit &amp; Loss</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/reports/balance-sheet"
                isCurrent={pathname === "/reports/balance-sheet"}
              >
                <IconCircleQuestionmark />
                <SidebarLabel>Balance Sheet</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/reports/cashflow"
                isCurrent={pathname === "/reports/cashflow"}
              >
                <IconWallet />
                <SidebarLabel>Cashflow</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarSectionGroup>
        </SidebarContent>
        <SidebarFooter>
          <button
            type="button"
            onClick={() => auth.signOut()}
            className="flex w-full items-center gap-2 rounded-md p-2 text-sm hover:bg-accent"
          >
            <IconLogout className="size-4" />
            <span className="truncate">{user?.email ?? "Sign out"}</span>
          </button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-bg px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium">{title}</h1>
        </header>
        <main className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

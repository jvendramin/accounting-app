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
import { Avatar } from "@/components/ui/avatar"
import {
  Menu,
  MenuContent,
  MenuHeader,
  MenuItem,
  MenuLabel,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import { ChevronUpDownIcon } from "@heroicons/react/24/outline"
import { auth } from "@/lib/auth"
import { SettingsModal } from "@/components/settings-modal"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTheme } from "@/components/theme-provider"
import {
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline"
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
  IconTag,
  IconActivity,
  IconTax,
} from "@/components/icons"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/transactions": "Transactions",
  "/accounts": "Chart of Accounts",
  "/categories": "Categories",
  "/taxes": "Taxes",
  "/reports/taxes": "Tax Report",
  "/receipts": "Receipts",
  "/import": "Import",
  "/activity": "Activity",
  "/reports/pnl": "Profit & Loss",
  "/reports/balance-sheet": "Balance Sheet",
  "/reports/cashflow": "Cashflow",
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = titles[pathname] ?? "Books"
  const session = auth.useSession()
  const user = session.data?.user
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [txCount, setTxCount] = useState<number | null>(null)
  useEffect(() => {
    fetch("/api/transactions/count_recent")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTxCount(d.count))
      .catch(() => {})
  }, [pathname])
  const initials = (() => {
    const name = user?.name?.trim()
    if (name) {
      const parts = name.split(/\s+/)
      return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
    }
    return (user?.email ?? "?").slice(0, 2).toUpperCase()
  })()

  return (
    <SidebarProvider>
      <Sidebar intent="inset" collapsible="dock">
        <SidebarHeader>
          <SidebarLabel className="font-semibold">Books</SidebarLabel>
        </SidebarHeader>
        <SidebarContent>
          <SidebarSectionGroup>
            <SidebarSection label="Books">
              <SidebarItem href="/" isCurrent={pathname === "/"}>
                <IconHome />
                <SidebarLabel>Dashboard</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/transactions"
                isCurrent={pathname === "/transactions"}
                badge={
                  txCount && txCount > 0
                    ? `${txCount} this week`
                    : undefined
                }
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
                href="/categories"
                isCurrent={pathname === "/categories"}
              >
                <IconTag />
                <SidebarLabel>Categories</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/taxes"
                isCurrent={pathname === "/taxes"}
              >
                <IconTax />
                <SidebarLabel>Taxes</SidebarLabel>
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
              <SidebarItem
                href="/activity"
                isCurrent={pathname === "/activity"}
              >
                <IconActivity />
                <SidebarLabel>Activity</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
            <SidebarSection label="Reporting">
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
              <SidebarItem
                href="/reports/taxes"
                isCurrent={pathname === "/reports/taxes"}
              >
                <IconTax />
                <SidebarLabel>Tax Report</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarSectionGroup>
        </SidebarContent>
        <SidebarFooter>
          <Menu>
            <MenuTrigger
              className="flex w-full items-center justify-between rounded-md p-2 hover:bg-sidebar-accent"
              aria-label="Account"
            >
              <div className="flex items-center gap-x-2 min-w-0">
                <Avatar
                  isSquare
                  initials={initials}
                  className="size-7 *:size-7"
                  alt={user?.name ?? user?.email ?? ""}
                />
                <div className="text-sm leading-tight min-w-0 in-data-[collapsible=dock]:hidden">
                  <SidebarLabel className="truncate">
                    {user?.name ?? user?.email}
                  </SidebarLabel>
                  {user?.name && (
                    <span className="block truncate text-xs text-muted-fg">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
              <ChevronUpDownIcon
                data-slot="chevron"
                className="size-4 opacity-60 in-data-[collapsible=dock]:hidden"
              />
            </MenuTrigger>
            <MenuContent
              placement="top end"
              className="min-w-(--trigger-width) sm:min-w-56"
            >
              {user && (
                <MenuSection>
                  <MenuHeader separator>
                    <span className="block">{user.name ?? user.email}</span>
                    {user.name && (
                      <span className="font-normal text-muted-fg">
                        {user.email}
                      </span>
                    )}
                  </MenuHeader>
                </MenuSection>
              )}
              <MenuItem onAction={() => setSettingsOpen(true)}>
                <Cog6ToothIcon />
                <MenuLabel>Settings</MenuLabel>
              </MenuItem>
              <div
                role="presentation"
                className="px-2 py-1.5"
                onKeyDownCapture={(e) => e.stopPropagation()}
              >
                <ToggleGroup
                  size="sm"
                  selectedKeys={new Set([theme ?? "system"])}
                  onSelectionChange={(keys) => {
                    const k = [...keys][0]
                    if (k) setTheme(k as "light" | "dark" | "system")
                  }}
                  className="w-full *:[button]:flex-1"
                  aria-label="Theme"
                >
                  <ToggleGroupItem id="light" aria-label="Light">
                    <SunIcon />
                  </ToggleGroupItem>
                  <ToggleGroupItem id="dark" aria-label="Dark">
                    <MoonIcon />
                  </ToggleGroupItem>
                  <ToggleGroupItem id="system" aria-label="System">
                    <ComputerDesktopIcon />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <MenuSeparator />
              <MenuItem intent="danger" onAction={() => auth.signOut()}>
                <IconLogout />
                Sign out
              </MenuItem>
            </MenuContent>
          </Menu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-muted px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium">{title}</h1>
        </header>
        <main className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </SidebarProvider>
  )
}

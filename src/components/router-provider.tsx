"use client"

import { useRouter } from "next/navigation"
import { RouterProvider } from "react-aria-components"

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: {
      scroll?: boolean
    }
  }
}

// Wires every React Aria <Link href> through the Next.js client router
// (push/replace) so navigations stay within the SPA shell — sidebar/layout
// don't remount, and prefetched route bundles can mount instantly.
export function AriaRouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  return (
    <RouterProvider navigate={router.push}>{children}</RouterProvider>
  )
}

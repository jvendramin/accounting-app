"use client"

import { useEffect } from "react"

// Registers /sw.js once on first paint of the app shell. The SW itself is
// intentionally minimal — its only job today is to satisfy Chrome's
// installability criteria (a fetch handler must be present).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  }, [])
  return null
}

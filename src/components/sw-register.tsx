"use client"

import { useEffect } from "react"

// Service worker disabled while we debug a PWA login regression — for now
// the priority is killing any existing SW registrations so installed PWAs
// fall back to plain network behaviour. Re-enable once we understand the
// auth-rejection cause.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
      .catch(() => {})
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => keys.forEach((k) => caches.delete(k).catch(() => {})))
        .catch(() => {})
    }
  }, [])
  return null
}

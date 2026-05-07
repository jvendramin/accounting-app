// Self-destruct service worker: if any old client still has /sw.js pinned,
// activating this version unregisters itself and clears every cache. We can
// re-introduce a real SW once the PWA login flow is understood; for now we
// want zero SW interference with auth.
self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      } catch {}
      try {
        await self.registration.unregister()
      } catch {}
      try {
        const clients = await self.clients.matchAll({ type: "window" })
        clients.forEach((c) => c.navigate(c.url))
      } catch {}
    })(),
  )
})

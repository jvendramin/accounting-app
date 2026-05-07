// Minimal service worker so Chrome's "Install app" criteria are met.
// We don't aggressively pre-cache anything (Next emits hashed asset URLs and
// a stale shell would just be a foot-gun); the fetch handler is a passthrough
// to the network with a tiny offline fallback for the app shell.
const CACHE = "books-shell-v2"
const SHELL = ["/"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  // Only cache navigations — let everything else pass through. Also bail on
  // cross-origin (auth/data API hosts) so we never proxy an auth request
  // through the SW.
  if (req.mode !== "navigate") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  event.respondWith(
    fetch(req).catch(() =>
      caches.match("/").then((r) => r || Response.error()),
    ),
  )
})

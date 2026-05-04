import { useEffect, useRef, useState } from "react"

/**
 * Stale-while-revalidate cache for GET requests.
 *
 * - Returns cached data instantly on subsequent navigations (no flicker).
 * - sessionStorage-backed so the cache survives in-tab navigation but not
 *   tab close (financial data shouldn't outlive the session).
 * - When data is older than `ttlMs`, the cached value is still returned
 *   immediately while a background refetch updates it.
 */
const memCache = new Map<string, { data: unknown; ts: number }>()

interface CacheEntry<T> {
  data: T
  ts: number
}

function readSession<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null
  } catch {
    return null
  }
}

function writeSession<T>(key: string, entry: CacheEntry<T>) {
  try {
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch {
    /* quota or disabled — silently ignore */
  }
}

export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttlMs?: number; enabled?: boolean } = {},
): { data: T | undefined; loading: boolean; refetch: () => void } {
  const { ttlMs = 5 * 60 * 1000, enabled = true } = options

  const [data, setData] = useState<T | undefined>(() => {
    const mem = memCache.get(key) as CacheEntry<T> | undefined
    if (mem) return mem.data
    const session = readSession<T>(key)
    if (session) {
      memCache.set(key, session)
      return session.data
    }
    return undefined
  })

  const [loading, setLoading] = useState(() => {
    const mem = memCache.get(key) as CacheEntry<T> | undefined
    return !mem && !readSession<T>(key)
  })

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const fetchNow = () => {
    if (!enabled) return
    const cached = (memCache.get(key) as CacheEntry<T> | undefined) ?? readSession<T>(key)
    if (!cached) setLoading(true)
    fetcherRef.current()
      .then((fresh) => {
        const entry: CacheEntry<T> = { data: fresh, ts: Date.now() }
        memCache.set(key, entry)
        writeSession(key, entry)
        setData(fresh)
      })
      .catch(() => {
        // Errors are toasted by the axios response interceptor — we just
        // need to swallow the rejection here so it doesn't bubble as an
        // unhandled promise and so finally still clears loading.
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!enabled) return
    const cached = (memCache.get(key) as CacheEntry<T> | undefined) ?? readSession<T>(key)
    if (cached) {
      // Hydrate immediately, then revalidate if stale.
      memCache.set(key, cached)
      setData(cached.data)
      setLoading(false)
      const isStale = Date.now() - cached.ts > ttlMs
      if (isStale) fetchNow()
    } else {
      fetchNow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return { data, loading, refetch: fetchNow }
}

/** Manually invalidate one or many cache keys (e.g. after a mutation). */
export function invalidateCache(...keys: string[]) {
  for (const k of keys) {
    memCache.delete(k)
    try {
      sessionStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  }
}

/**
 * Invalidate every cache entry whose key starts with `prefix`. Useful when a
 * resource is cached per-filter (e.g. `transactions:q=foo&type=deposit`) and a
 * mutation should bust every variant at once.
 */
export function invalidateCachePrefix(prefix: string) {
  for (const key of Array.from(memCache.keys())) {
    if (key.startsWith(prefix)) memCache.delete(key)
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(prefix)) sessionStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}

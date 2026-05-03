import { useEffect, useState } from "react"

/**
 * Pass-through. Previously enforced a 1s minimum to showcase the loading
 * skeleton — that's a UX anti-pattern in production, so it's been removed.
 * Kept as an identity wrapper so existing call sites compile unchanged.
 */
export function withMinDelay<T>(promise: Promise<T>, _ms = 1000): Promise<T> {
  return promise
}

/**
 * Returns `value` after `delay` ms of no further changes. Used to coalesce
 * search-input keystrokes into one network request.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

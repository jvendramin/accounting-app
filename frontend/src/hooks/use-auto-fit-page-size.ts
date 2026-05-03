import { useEffect, useRef, useState, type RefObject } from "react"

/**
 * Returns a ref + a page-size number that recomputes whenever the referenced
 * element changes height. Page size = floor((containerHeight - headerHeight)
 * / rowHeight). Use to auto-fit table rows to the available viewport space.
 */
export function useAutoFitPageSize(
  rowHeightPx: number = 40,
  headerHeightPx: number = 40,
  fallback: number = 20,
): { ref: RefObject<HTMLDivElement | null>; pageSize: number } {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pageSize, setPageSize] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const calc = () => {
      const usable = el.clientHeight - headerHeightPx
      const n = Math.max(1, Math.floor(usable / rowHeightPx))
      setPageSize((prev) => (prev === n ? prev : n))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [rowHeightPx, headerHeightPx])

  return { ref, pageSize }
}

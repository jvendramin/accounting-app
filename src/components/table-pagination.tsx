"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ComboBox,
  ComboBoxContent,
  ComboBoxInput,
  ComboBoxItem,
} from "@/components/ui/combo-box"
import { ChevronLeft, ChevronRight } from "lucide-react"

const STORAGE_KEY = "books:items_per_page"
export const DEFAULT_PAGE_SIZE = 50
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200]

// Persist the user's choice across pages and reloads. Settings modal also
// writes the same key when "items_per_page" is saved, so changes there flow
// through to every table.
export function usePageSize(): [number, (n: number) => void] {
  const [size, setSize] = useState<number>(DEFAULT_PAGE_SIZE)
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = Number(window.localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(stored) && stored > 0) setSize(stored)
  }, [])
  const update = (n: number) => {
    setSize(n)
    if (typeof window !== "undefined")
      window.localStorage.setItem(STORAGE_KEY, String(n))
  }
  return [size, update]
}

// Reset page to 0 whenever the dependency changes (e.g. filter / search /
// page-size). Keeps callers concise.
export function usePage(resetDeps: unknown[] = []) {
  const [page, setPage] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(0), resetDeps)
  return [page, setPage] as const
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  return rows.slice(page * pageSize, (page + 1) * pageSize)
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  if (total === 0) return null
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1)
  const start = total === 0 ? 0 : page * pageSize + 1
  const end = Math.min(total, (page + 1) * pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-bg/50 px-2 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-fg">
          {start}–{end}{" "}
          <span className="hidden sm:inline">of {total}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-fg sm:inline">Per page</span>
        <ComboBox
          aria-label="Rows per page"
          selectedKey={String(pageSize)}
          onSelectionChange={(k) =>
            k != null && onPageSizeChange(Number(k))
          }
          className="w-[88px]"
        >
          <ComboBoxInput />
          <ComboBoxContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <ComboBoxItem key={n} id={String(n)} textValue={String(n)}>
                {n}
              </ComboBoxItem>
            ))}
          </ComboBoxContent>
        </ComboBox>
        <div className="flex items-center gap-1">
          <Button
            intent="outline"
            size="sq-sm"
            aria-label="Previous page"
            isDisabled={page <= 0}
            onPress={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-[3rem] text-center tabular-nums text-xs text-muted-fg">
            {page + 1} / {lastPage + 1}
          </span>
          <Button
            intent="outline"
            size="sq-sm"
            aria-label="Next page"
            isDisabled={page >= lastPage}
            onPress={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}

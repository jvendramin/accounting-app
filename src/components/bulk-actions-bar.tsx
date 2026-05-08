"use client"

import type { Selection as RACSelection } from "react-aria-components"
import { Button } from "@/components/ui/button"
import { IconTrash, IconX } from "@/components/icons"

export type Selection = RACSelection

// Floating bottom-anchored bar shown only when rows are selected. Replaces
// the previous inline toolbar that pushed content down on every selection.
// On mobile it spans the available width with a small inset, on desktop it
// centres to a max-width and clears the sidebar on the left.
export function BulkActionsBar({
  selection,
  totalRows,
  onClear,
  onDelete,
  label = "selected",
}: {
  selection: Selection
  totalRows: number
  onClear: () => void
  onDelete: () => void
  label?: string
}) {
  const count =
    selection === "all" ? totalRows : (selection as Set<unknown>).size
  if (count === 0) return null
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={[
        // Anchor to bottom centre, above any browser chrome / safe-area.
        "pointer-events-none fixed inset-x-0 z-40 flex justify-center",
        "bottom-[calc(env(safe-area-inset-bottom,0)+--spacing(3))]",
        // Width: edge-to-edge with a small inset on phones; capped on
        // larger screens so it doesn't stretch absurdly wide.
        "px-3 sm:px-4",
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-auto flex w-full max-w-md items-center gap-2",
          "rounded-2xl border bg-overlay/95 px-3 py-2 shadow-lg backdrop-blur",
          "supports-[backdrop-filter]:bg-overlay/80",
          "motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in motion-safe:duration-150",
        ].join(" ")}
      >
        <Button
          intent="plain"
          size="sq-sm"
          aria-label="Clear selection"
          onPress={onClear}
        >
          <IconX />
        </Button>
        <span className="text-sm font-medium tabular-nums">
          {count} {label}
        </span>
        <Button
          intent="danger"
          size="sm"
          onPress={onDelete}
          className="ms-auto"
        >
          <IconTrash />
          Delete {count}
        </Button>
      </div>
    </div>
  )
}

export function selectedIds(
  selection: Selection,
  allRows: { id: number }[],
): number[] {
  return selection === "all"
    ? allRows.map((r) => r.id)
    : [...(selection as Set<unknown>)].map((k) => Number(k))
}

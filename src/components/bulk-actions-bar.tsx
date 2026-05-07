"use client"

import type { Selection as RACSelection } from "react-aria-components"
import { Button } from "@/components/ui/button"
import { IconTrash } from "@/components/icons"

export type Selection = RACSelection

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
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <span className="font-medium">
        {count} {label}
      </span>
      <div className="flex items-center gap-2">
        <Button intent="plain" size="sm" onPress={onClear}>
          Clear
        </Button>
        <Button intent="danger" size="sm" onPress={onDelete}>
          <IconTrash /> Delete {count}
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

"use client"

import type { Selection as RACSelection } from "react-aria-components"
import { Button } from "@/components/ui/button"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
} from "@/components/ui/menu"
import { IconTrash, IconX } from "@/components/icons"
import { Download, FileJson, FileSpreadsheet, ClipboardCopy } from "lucide-react"
import { toast } from "sonner"

export type Selection = RACSelection
export type ExportFormat = "csv" | "json" | "clipboard"

// Floating bottom-anchored bar shown only when rows are selected. Opt-in
// `getExportRows` callback enables an Export dropdown (CSV / JSON file /
// JSON to clipboard) — the page just maps its own selection → array of
// plain objects and the bar handles the file plumbing.
export function BulkActionsBar({
  selection,
  totalRows,
  onClear,
  onDelete,
  label = "selected",
  getExportRows,
  exportFilename = "export",
}: {
  selection: Selection
  totalRows: number
  onClear: () => void
  onDelete: () => void
  label?: string
  getExportRows?: () => Record<string, unknown>[]
  exportFilename?: string
}) {
  const count =
    selection === "all" ? totalRows : (selection as Set<unknown>).size
  if (count === 0) return null

  const handleExport = async (format: ExportFormat) => {
    if (!getExportRows) return
    const rows = getExportRows()
    if (!rows.length) {
      toast.error("Nothing to export")
      return
    }
    try {
      if (format === "csv") {
        const blob = new Blob([toCsv(rows)], {
          type: "text/csv;charset=utf-8",
        })
        downloadBlob(blob, `${exportFilename}.csv`)
        toast.success(`Exported ${rows.length} rows`)
      } else if (format === "json") {
        const blob = new Blob([JSON.stringify(rows, null, 2)], {
          type: "application/json",
        })
        downloadBlob(blob, `${exportFilename}.json`)
        toast.success(`Exported ${rows.length} rows`)
      } else {
        await navigator.clipboard.writeText(JSON.stringify(rows, null, 2))
        toast.success(`Copied ${rows.length} rows as JSON`)
      }
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Export failed"
      toast.error(m)
    }
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={[
        "pointer-events-none fixed inset-x-0 z-40 flex justify-center",
        "bottom-[calc(env(safe-area-inset-bottom,0)+--spacing(8))] sm:bottom-[calc(env(safe-area-inset-bottom,0)+--spacing(4))]",
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
        <div className="ms-auto flex items-center gap-1.5">
          {getExportRows && (
            <Menu>
              <Button intent="outline" size="sm" aria-label="Export">
                <Download />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <MenuContent placement="top end">
                <MenuItem onAction={() => handleExport("csv")}>
                  <FileSpreadsheet />
                  <MenuLabel>Export CSV</MenuLabel>
                </MenuItem>
                <MenuItem onAction={() => handleExport("json")}>
                  <FileJson />
                  <MenuLabel>Export JSON</MenuLabel>
                </MenuItem>
                <MenuItem onAction={() => handleExport("clipboard")}>
                  <ClipboardCopy />
                  <MenuLabel>Copy JSON</MenuLabel>
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
          <Button intent="danger" size="sm" onPress={onDelete}>
            <IconTrash />
            Delete {count}
          </Button>
        </div>
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

// ---------------------------------------------------------------------------

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  // Union of keys across all rows so jagged objects still serialise cleanly.
  const headerSet = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) headerSet.add(k)
  const headers = [...headerSet]
  const escape = (v: unknown): string => {
    if (v == null) return ""
    const s =
      typeof v === "string"
        ? v
        : typeof v === "number" || typeof v === "boolean"
          ? String(v)
          : JSON.stringify(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ]
  return lines.join("\n")
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer revoke a tick so Safari has time to fire the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

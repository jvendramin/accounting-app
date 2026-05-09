"use client"

import { Button } from "@/components/ui/button"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuTrigger,
} from "@/components/ui/menu"
import { Download, FileJson, FileSpreadsheet, ClipboardCopy } from "lucide-react"
import { toast } from "sonner"
import { exportRows, type ExportFormat } from "@/lib/export"

// Drop into any report card header. `getRows` is invoked lazily so the
// caller can defer expensive shape transforms until the user clicks.
// Multiple sections (e.g. Balance Sheet's assets/liabilities/equity)
// emit a multi-section CSV with `# <section>` separators.
export function ReportExportMenu({
  filename,
  getRows,
  disabled,
  size = "sm",
}: {
  filename: string
  getRows: () => Record<string, Record<string, unknown>[]>
  disabled?: boolean
  size?: "xs" | "sm"
}) {
  const handle = async (format: ExportFormat) => {
    try {
      const data = getRows()
      const total = Object.values(data).reduce(
        (s, rows) => s + rows.length,
        0,
      )
      if (total === 0) {
        toast.error("Nothing to export")
        return
      }
      await exportRows(format, filename, data)
      toast.success(
        format === "clipboard"
          ? "Copied to clipboard"
          : `Exported ${total} row${total === 1 ? "" : "s"}`,
      )
    } catch (e) {
      const m = e instanceof Error ? e.message : "Export failed"
      toast.error(m)
    }
  }
  return (
    <Menu>
      <MenuTrigger>
        <Button intent="outline" size={size} isDisabled={disabled}>
          <Download className="size-4" /> Export
        </Button>
      </MenuTrigger>
      <MenuContent placement="bottom end">
        <MenuLabel>Export report</MenuLabel>
        <MenuItem onAction={() => handle("csv")}>
          <FileSpreadsheet /> CSV
        </MenuItem>
        <MenuItem onAction={() => handle("json")}>
          <FileJson /> JSON
        </MenuItem>
        <MenuItem onAction={() => handle("clipboard")}>
          <ClipboardCopy /> Copy CSV
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

// Shared export helpers used by tables and report pages.
// Keep this dependency-free so any client component can import it.

export type ExportFormat = "csv" | "json" | "clipboard"

export function toCsv(rows: Record<string, unknown>[]): string {
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

export function downloadBlob(blob: Blob, filename: string) {
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

// Hands the chosen format off as a download (csv/json) or clipboard
// copy. Pass a record with one or more named row sets to emit a
// multi-section CSV (each section gets a `# Section` comment line).
export async function exportRows(
  format: ExportFormat,
  filename: string,
  data: Record<string, Record<string, unknown>[]>,
): Promise<void> {
  const sections = Object.entries(data)
  if (format === "json") {
    const payload =
      sections.length === 1 ? sections[0][1] : Object.fromEntries(sections)
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    downloadBlob(blob, `${filename}.json`)
    return
  }
  const csv =
    sections.length === 1
      ? toCsv(sections[0][1])
      : sections
          .map(([name, rows]) => `# ${name}\n${toCsv(rows)}`)
          .join("\n\n")
  if (format === "clipboard") {
    await navigator.clipboard.writeText(csv)
    return
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  downloadBlob(blob, `${filename}.csv`)
}

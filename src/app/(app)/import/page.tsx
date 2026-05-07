"use client"

import { useMemo, useState } from "react"
import { TableBody } from "react-aria-components"
import {
  Table,
  TableCell,
  TableColumn,
  TableHeader as IntentTableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { FilePond, registerPlugin } from "react-filepond"
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type"
import "filepond/dist/filepond.min.css"
import "@/styles/filepond.css"
registerPlugin(FilePondPluginFileValidateType)
import {
  ComboBox,
  ComboBoxContent,
  ComboBoxInput,
  ComboBoxItem,
} from "@/components/ui/combo-box"
import { Badge } from "@/components/ui/badge"
import { IconPlus, IconTrash } from "@/components/icons"
import { toast } from "sonner"
import { fmtMoney } from "@/lib/format"
import { api, type Account } from "@/lib/api"
import {
  invalidateCachePrefix,
  useCachedFetch,
} from "@/hooks/use-cached-fetch"

type Pending = {
  id: string
  date: string
  description: string
  reference: string
  kind: "deposit" | "withdrawal"
  account_id?: number
  category_id?: number
  amount: number
}

function parseCsv(text: string): Array<Record<string, string>> {
  // Tiny CSV parser: comma-delimited, double-quote escapes. Good enough for
  // bank exports; if you need RFC 4180 fully, swap for papaparse.
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length > 0)
  if (lines.length === 0) return []
  const split = (line: string) => {
    const out: string[] = []
    let cur = ""
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        inQ = !inQ
      } else if (c === "," && !inQ) {
        out.push(cur)
        cur = ""
      } else {
        cur += c
      }
    }
    out.push(cur)
    return out
  }
  const header = split(lines[0]).map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cols = split(line)
    const row: Record<string, string> = {}
    header.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim()
    })
    return row
  })
}

export default function ImportPage() {
  const { data: accountsData } = useCachedFetch<Account[]>(
    "accounts:all",
    () => api.get("/api/accounts"),
  )
  const accounts = accountsData ?? []
  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "asset"),
    [accounts],
  )
  const [pending, setPending] = useState<Pending[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)

  const ingestRows = (rows: Array<Record<string, string>>) => {
    const next: Pending[] = rows.map((r, i) => {
      const amount = Number(r.amount ?? r.value ?? 0)
      return {
        id: `csv-${i}`,
        date: r.date ?? new Date().toISOString().slice(0, 10),
        description: r.description ?? r.memo ?? "",
        reference: r.reference ?? "",
        kind: amount < 0 ? "withdrawal" : "deposit",
        amount: Math.abs(amount),
        account_id: cashAccounts[0]?.id,
      }
    })
    setPending(next)
  }

  const handleFile = async (file: File) => {
    const lower = file.name.toLowerCase()
    if (lower.endsWith(".csv")) {
      ingestRows(parseCsv(await file.text()))
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      // Lazy-load xlsx (~500KB) only when the user actually picks an Excel file.
      const XLSX = await import("xlsx")
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const arr = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: "",
      })
      ingestRows(
        arr.map((row) => {
          const out: Record<string, string> = {}
          for (const k of Object.keys(row)) {
            out[k.toLowerCase().trim()] = String(row[k] ?? "")
          }
          return out
        }),
      )
    } else {
      toast.error("Only .csv, .xlsx, .xls files are supported")
      return
    }
    setPickerOpen(false)
    toast.success(`Loaded ${file.name}`)
  }

  const update = (id: string, patch: Partial<Pending>) =>
    setPending((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRow = (id: string) =>
    setPending((p) => p.filter((r) => r.id !== id))
  const clearAll = () => setPending([])

  const importAll = async () => {
    if (pending.length === 0) return
    if (pending.some((p) => !p.account_id || !p.category_id)) {
      toast.error("Set account & category on every row first")
      return
    }
    setSubmitting(true)
    try {
      const txs = pending.map((p) => ({
        date: p.date,
        description: p.description,
        reference: p.reference,
        transaction_type: p.kind,
        amount: p.amount,
        journal_lines_attributes:
          p.kind === "deposit"
            ? [
                { account_id: p.account_id!, debit: p.amount, credit: 0 },
                { account_id: p.category_id!, debit: 0, credit: p.amount },
              ]
            : [
                { account_id: p.category_id!, debit: p.amount, credit: 0 },
                { account_id: p.account_id!, debit: 0, credit: p.amount },
              ],
      }))
      await api.post("/api/transactions/bulk_create", { transactions: txs })
      invalidateCachePrefix("transactions:")
      toast.success(`Imported ${txs.length} transactions`)
      setPending([])
    } catch {
      /* api helper toasts */
    } finally {
      setSubmitting(false)
    }
  }

  const incomeAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "income"),
    [accounts],
  )
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "expense"),
    [accounts],
  )

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <CardTitle>Import transactions</CardTitle>
        <div className="flex flex-col items-stretch gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:w-auto">
          {pending.length > 0 && (
            <>
              <Button intent="plain" onPress={clearAll}>
                Clear
              </Button>
              <Button onPress={importAll} isPending={submitting}>
                Import {pending.length}
              </Button>
            </>
          )}
          <Button onPress={() => setPickerOpen(true)}>
            <IconPlus /> Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className="flex-1 overflow-auto px-4 py-0 [&_table]:min-w-[760px]"
        style={{ "--gutter": "1rem" } as React.CSSProperties}
      >
        <Table aria-label="Staged transactions">
          <IntentTableHeader>
            <TableColumn id="date" isRowHeader>Date</TableColumn>
            <TableColumn id="desc">Description</TableColumn>
            <TableColumn id="kind">Kind</TableColumn>
            <TableColumn id="amt">Amount</TableColumn>
            <TableColumn id="acct">Account</TableColumn>
            <TableColumn id="cat">Category</TableColumn>
            <TableColumn id="act">{""}</TableColumn>
          </IntentTableHeader>
          <TableBody
            items={pending}
            renderEmptyState={() => (
              <div className="p-8 text-center text-sm text-muted-fg">
                Choose a CSV with `date`, `description`, `amount` columns to begin.
              </div>
            )}
          >
            {(p) => (
              <TableRow id={p.id}>
                <TableCell className="font-mono text-xs">{p.date}</TableCell>
                <TableCell>{p.description}</TableCell>
                <TableCell>
                  <Badge
                    intent={p.kind === "deposit" ? "success" : "danger"}
                    onClick={() =>
                      update(p.id, {
                        kind: p.kind === "deposit" ? "withdrawal" : "deposit",
                      })
                    }
                    className="cursor-pointer"
                  >
                    {p.kind}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMoney(p.amount)}
                </TableCell>
                <TableCell>
                  <ComboBox
                    aria-label="Account"
                    selectedKey={p.account_id ?? null}
                    onSelectionChange={(k) =>
                      update(p.id, {
                        account_id: k == null ? undefined : Number(k),
                      })
                    }
                  >
                    <ComboBoxInput placeholder="Select" />
                    <ComboBoxContent items={cashAccounts}>
                      {(a) => (
                        <ComboBoxItem
                          id={a.id}
                          textValue={`${a.code} — ${a.name}`}
                        >
                          {`${a.code} — ${a.name}`}
                        </ComboBoxItem>
                      )}
                    </ComboBoxContent>
                  </ComboBox>
                </TableCell>
                <TableCell>
                  <ComboBox
                    aria-label="Category"
                    selectedKey={p.category_id ?? null}
                    onSelectionChange={(k) =>
                      update(p.id, {
                        category_id: k == null ? undefined : Number(k),
                      })
                    }
                  >
                    <ComboBoxInput placeholder="Select" />
                    <ComboBoxContent
                      items={
                        p.kind === "deposit" ? incomeAccounts : expenseAccounts
                      }
                    >
                      {(a) => (
                        <ComboBoxItem
                          id={a.id}
                          textValue={`${a.code} — ${a.name}`}
                        >
                          {`${a.code} — ${a.name}`}
                        </ComboBoxItem>
                      )}
                    </ComboBoxContent>
                  </ComboBox>
                </TableCell>
                <TableCell>
                  <Button intent="plain" size="sq-sm" onPress={() => removeRow(p.id)}>
                    <IconTrash />
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <ModalContent
        size="2xl"
        isOpen={pickerOpen}
        onOpenChange={setPickerOpen}
      >
        <ModalHeader>
          <ModalTitle>Choose CSV or Excel</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <FilePond
            allowMultiple={false}
            credits={false}
            instantUpload={false}
            allowProcess={false}
            acceptedFileTypes={[
              "text/csv",
              "application/vnd.ms-excel",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ]}
            fileValidateTypeLabelExpectedTypes="Expects .csv, .xlsx or .xls"
            fileValidateTypeDetectType={(source, type) =>
              new Promise((resolve) => {
                const n = source.name.toLowerCase()
                if (n.endsWith(".csv")) resolve("text/csv")
                else if (n.endsWith(".xlsx"))
                  resolve(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  )
                else if (n.endsWith(".xls"))
                  resolve("application/vnd.ms-excel")
                else resolve(type)
              })
            }
            labelIdle='Drop a CSV or Excel file, or <span class="filepond--label-action">browse</span>'
            onaddfile={(err, item) => {
              if (err || !item?.file) return
              handleFile(item.file as File)
            }}
          />
        </ModalBody>
      </ModalContent>
    </Card>
  )
}

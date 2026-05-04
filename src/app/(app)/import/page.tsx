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
import { FileTrigger } from "@/components/ui/file-trigger"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
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

  const handleFile = async (files: FileList | null) => {
    if (!files || !files[0]) return
    const text = await files[0].text()
    const rows = parseCsv(text)
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
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <FileTrigger acceptedFileTypes={[".csv"]} onSelect={handleFile}>
            <Button intent="outline">
              <IconPlus /> Choose CSV
            </Button>
          </FileTrigger>
          <Button intent="plain" onPress={clearAll} isDisabled={pending.length === 0}>
            Clear
          </Button>
          <Button
            onPress={importAll}
            isPending={submitting}
            isDisabled={pending.length === 0}
          >
            Import {pending.length || ""}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
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
                  <Select
                    aria-label="Account"
                    selectedKey={p.account_id ? String(p.account_id) : undefined}
                    onSelectionChange={(k) =>
                      update(p.id, { account_id: Number(k) })
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {cashAccounts.map((a) => (
                        <SelectItem key={a.id} id={String(a.id)}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    aria-label="Category"
                    selectedKey={
                      p.category_id ? String(p.category_id) : undefined
                    }
                    onSelectionChange={(k) =>
                      update(p.id, { category_id: Number(k) })
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {(p.kind === "deposit"
                        ? incomeAccounts
                        : expenseAccounts
                      ).map((a) => (
                        <SelectItem key={a.id} id={String(a.id)}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </Card>
  )
}

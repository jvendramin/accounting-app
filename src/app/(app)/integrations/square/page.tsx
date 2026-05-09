"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/field"
import { TextField } from "@/components/ui/text-field"
import { Badge } from "@/components/ui/badge"
import {
  ComboBox,
  ComboBoxContent,
  ComboBoxInput,
  ComboBoxItem,
} from "@/components/ui/combo-box"
import { DatePicker, DatePickerTrigger } from "@/components/ui/date-picker"
import { parseDate } from "@internationalized/date"
import { toast } from "sonner"
import { api, type Account } from "@/lib/api"
import { fmtMoney } from "@/lib/format"
import { useCachedFetch, invalidateCachePrefix } from "@/hooks/use-cached-fetch"

type Suggestion = {
  square_id: string
  invoice_number?: string
  title: string
  description: string
  amount: number
  paid_at: string
  customer: string
  already_imported: boolean
}

type SyncResp = {
  invoices: Suggestion[]
  counts: { fetched: number; new: number; existing: number }
}

const TOKEN_KEY = "square:access_token"
const ENV_KEY = "square:environment"

export default function SquareIntegrationPage() {
  const [token, setToken] = useState("")
  const [environment, setEnvironment] = useState<"production" | "sandbox">(
    "production",
  )
  const [since, setSince] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resp, setResp] = useState<SyncResp | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Restore token from localStorage so the user doesn't have to paste it
  // every time. (Read-only at the gateway; downstream can validate.)
  useEffect(() => {
    const t = window.localStorage.getItem(TOKEN_KEY) ?? ""
    setToken(t)
    const e = window.localStorage.getItem(ENV_KEY) as
      | "production"
      | "sandbox"
      | null
    if (e) setEnvironment(e)
  }, [])

  const { data: accountsData } = useCachedFetch<Account[]>(
    "accounts:all",
    () => api.get("/api/accounts"),
  )
  const accounts = useMemo(() => accountsData ?? [], [accountsData])
  const cashAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.account_type === "asset" || a.account_type === "liability",
      ),
    [accounts],
  )
  const incomeAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "income"),
    [accounts],
  )
  const [accountId, setAccountId] = useState<number | undefined>(undefined)
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)
  // Default to the first asset and the first income account so the
  // happy-path import is one click.
  useEffect(() => {
    if (accountId == null && cashAccounts[0]) setAccountId(cashAccounts[0].id)
  }, [cashAccounts, accountId])
  useEffect(() => {
    if (categoryId == null && incomeAccounts[0])
      setCategoryId(incomeAccounts[0].id)
  }, [incomeAccounts, categoryId])

  const sync = async () => {
    if (!token) {
      toast.error("Paste a Square access token first")
      return
    }
    setSyncing(true)
    try {
      window.localStorage.setItem(TOKEN_KEY, token)
      window.localStorage.setItem(ENV_KEY, environment)
      const r = await api.post<SyncResp>("/api/integrations/square/sync", {
        access_token: token,
        environment,
        ...(since ? { since } : {}),
      })
      setResp(r)
      const newOnes = r.invoices.filter((i) => !i.already_imported)
      setSelected(new Set(newOnes.map((i) => i.square_id)))
      toast.success(
        `Found ${r.counts.new} new, ${r.counts.existing} already imported`,
      )
    } catch (e) {
      const m = e instanceof Error ? e.message : "Square sync failed"
      toast.error(m)
    } finally {
      setSyncing(false)
    }
  }

  const importSelected = async () => {
    if (!resp) return
    if (!accountId || !categoryId) {
      toast.error("Pick a deposit account and an income category")
      return
    }
    const picked = resp.invoices.filter(
      (i) => selected.has(i.square_id) && !i.already_imported,
    )
    if (picked.length === 0) {
      toast.error("Nothing selected")
      return
    }
    setImporting(true)
    try {
      const r = await api.post<{ created: number }>(
        "/api/integrations/square/import",
        {
          account_id: accountId,
          category_id: categoryId,
          invoices: picked.map((p) => ({
            square_id: p.square_id,
            description: p.description,
            amount: p.amount,
            paid_at: p.paid_at,
          })),
        },
      )
      invalidateCachePrefix("transactions:")
      invalidateCachePrefix("dashboard:")
      toast.success(`Imported ${r.created} deposits`)
      // Re-sync so the just-imported rows flip to "already imported".
      await sync()
    } catch (e) {
      const m = e instanceof Error ? e.message : "Square import failed"
      toast.error(m)
    } finally {
      setImporting(false)
    }
  }

  const newSuggestions = (resp?.invoices ?? []).filter(
    (s) => !s.already_imported,
  )
  const existing = (resp?.invoices ?? []).filter((s) => s.already_imported)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 [&_*]:min-w-0 max-w-full overflow-x-clip">
      <Card>
        <CardHeader>
          <CardTitle>Square — paid invoices</CardTitle>
          <p className="text-sm text-muted-fg">
            Pulls every paid invoice from your Square account, diffs against
            existing transactions, and lets you import the missing ones as
            deposits in one click.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <TextField value={token} onChange={setToken} type="password">
            <Label>Access token</Label>
            <Input placeholder="EAA…" autoComplete="off" />
            <p className="text-xs text-muted-fg">
              Generate a personal access token in the{" "}
              <a
                href="https://developer.squareup.com/apps"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Square Developer Dashboard
              </a>
              . Stored only in this browser&rsquo;s local storage.
            </p>
          </TextField>
          <div className="grid gap-3 sm:grid-cols-2">
            <ComboBox
              selectedKey={environment}
              onSelectionChange={(k) =>
                k && setEnvironment(k as "production" | "sandbox")
              }
            >
              <Label>Environment</Label>
              <ComboBoxInput />
              <ComboBoxContent>
                <ComboBoxItem id="production">Production</ComboBoxItem>
                <ComboBoxItem id="sandbox">Sandbox</ComboBoxItem>
              </ComboBoxContent>
            </ComboBox>
            <DatePicker
              value={since ? parseDate(since) : null}
              onChange={(d) => setSince(d ? d.toString() : "")}
            >
              <Label>Only invoices paid since (optional)</Label>
              <DatePickerTrigger />
            </DatePicker>
          </div>
          <div>
            <Button onPress={sync} isPending={syncing}>
              Sync paid invoices
            </Button>
          </div>
        </CardContent>
      </Card>

      {resp && (
        <>
          <Card>
            <CardHeader className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                {newSuggestions.length} new deposit
                {newSuggestions.length === 1 ? "" : "s"} ready to import
              </CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <ComboBox
                  selectedKey={accountId ?? null}
                  onSelectionChange={(k) =>
                    setAccountId(k == null ? undefined : Number(k))
                  }
                  className="sm:w-56"
                >
                  <Label>Deposit into</Label>
                  <ComboBoxInput placeholder="Account" />
                  <ComboBoxContent items={cashAccounts}>
                    {(a) => (
                      <ComboBoxItem
                        id={a.id}
                        textValue={
                          a.code ? `${a.code} — ${a.name}` : a.name
                        }
                      >
                        {a.code ? `${a.code} — ${a.name}` : a.name}
                      </ComboBoxItem>
                    )}
                  </ComboBoxContent>
                </ComboBox>
                <ComboBox
                  selectedKey={categoryId ?? null}
                  onSelectionChange={(k) =>
                    setCategoryId(k == null ? undefined : Number(k))
                  }
                  className="sm:w-56"
                >
                  <Label>Income category</Label>
                  <ComboBoxInput placeholder="Category" />
                  <ComboBoxContent items={incomeAccounts}>
                    {(a) => (
                      <ComboBoxItem
                        id={a.id}
                        textValue={
                          a.code ? `${a.code} — ${a.name}` : a.name
                        }
                      >
                        {a.code ? `${a.code} — ${a.name}` : a.name}
                      </ComboBoxItem>
                    )}
                  </ComboBoxContent>
                </ComboBox>
                <Button
                  onPress={importSelected}
                  isPending={importing}
                  isDisabled={
                    selected.size === 0 || newSuggestions.length === 0
                  }
                >
                  Import {selected.size}
                </Button>
              </div>
            </CardHeader>
            <CardContent
              className="px-4 py-0 [&_table]:min-w-[640px]"
              style={{ "--gutter": "1rem" } as React.CSSProperties}
            >
              <Table
                aria-label="New Square invoices"
                selectionMode="multiple"
                selectedKeys={selected as unknown as Set<string>}
                onSelectionChange={(keys) => {
                  if (keys === "all") {
                    setSelected(
                      new Set(newSuggestions.map((s) => s.square_id)),
                    )
                  } else {
                    setSelected(new Set([...keys].map(String)))
                  }
                }}
              >
                <IntentTableHeader>
                  <TableColumn id="date">Paid</TableColumn>
                  <TableColumn id="desc" isRowHeader className="w-full">
                    Description
                  </TableColumn>
                  <TableColumn id="customer">Customer</TableColumn>
                  <TableColumn id="amount">Amount</TableColumn>
                </IntentTableHeader>
                <TableBody
                  items={newSuggestions.map((s) => ({
                    ...s,
                    id: s.square_id,
                  }))}
                  renderEmptyState={() => (
                    <div className="p-8 text-center text-sm text-muted-fg">
                      Everything Square knows about is already in your books.
                    </div>
                  )}
                >
                  {(s: any) => (
                    <TableRow id={s.square_id}>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {s.paid_at}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{s.title}</div>
                        {s.invoice_number && (
                          <div className="text-xs text-muted-fg">
                            #{s.invoice_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-fg">
                        {s.customer || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {fmtMoney(Number(s.amount))}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {existing.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {existing.length} already in your books
                </CardTitle>
                <p className="text-sm text-muted-fg">
                  Matched by Square invoice id or by (date, amount).
                </p>
              </CardHeader>
              <CardContent
                className="px-4 py-0 [&_table]:min-w-[640px]"
                style={{ "--gutter": "1rem" } as React.CSSProperties}
              >
                <Table aria-label="Already imported Square invoices">
                  <IntentTableHeader>
                    <TableColumn id="date">Paid</TableColumn>
                    <TableColumn id="desc" isRowHeader className="w-full">
                      Description
                    </TableColumn>
                    <TableColumn id="customer">Customer</TableColumn>
                    <TableColumn id="amount">Amount</TableColumn>
                  </IntentTableHeader>
                  <TableBody items={existing.map((s) => ({ ...s, id: s.square_id }))}>
                    {(s: any) => (
                      <TableRow id={s.square_id}>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {s.paid_at}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{s.title}</span>
                            <Badge intent="success">Imported</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-fg">
                          {s.customer || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtMoney(Number(s.amount))}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

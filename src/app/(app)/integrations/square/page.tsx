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
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
} from "@/components/ui/modal"
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
  matched?: {
    id: number
    date: string
    description: string
    amount: number
    reference: string | null
  } | null
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
  const [serverHasToken, setServerHasToken] = useState(false)
  const [since, setSince] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resp, setResp] = useState<SyncResp | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // The "already imported" row the user tapped — opens a modal showing
  // the matched local transaction with an "Import anyway" override.
  const [inspect, setInspect] = useState<Suggestion | null>(null)
  const [overriding, setOverriding] = useState(false)
  // Cross-check modal — searches the local transactions list without
  // leaving the page so the user can sanity-check a match before
  // importing.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState("")
  const [searchRows, setSearchRows] = useState<
    Array<{
      id: number
      date: string
      description: string
      amount: number
      transactionType?: string
      transaction_type?: string
      reference?: string | null
    }>
  >([])
  const [searchLoading, setSearchLoading] = useState(false)
  // Debounced fetch — fires whenever the modal is open and the query
  // settles for ~250ms.
  useEffect(() => {
    if (!searchOpen) return
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const r = await api.get<typeof searchRows>("/api/transactions", {
          ...(searchQ ? { q: searchQ } : {}),
        })
        setSearchRows(r.slice(0, 50))
      } catch {
        /* api helper toasts */
      } finally {
        setSearchLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [searchOpen, searchQ])

  // Prefer server-configured Square credentials (SQUARE_ACCESS_TOKEN in
  // .env.local). Fall back to localStorage for users running their own
  // copy without env access.
  useEffect(() => {
    api
      .get<{ has_token: boolean; environment: "production" | "sandbox" }>(
        "/api/integrations/square/config",
      )
      .then((c) => {
        setServerHasToken(c.has_token)
        if (c.has_token) {
          setEnvironment(c.environment)
          return
        }
        const t = window.localStorage.getItem(TOKEN_KEY) ?? ""
        setToken(t)
        const e = window.localStorage.getItem(ENV_KEY) as
          | "production"
          | "sandbox"
          | null
        if (e) setEnvironment(e)
      })
      .catch(() => {})
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
    if (!serverHasToken && !token) {
      toast.error("Paste a Square access token first")
      return
    }
    setSyncing(true)
    try {
      if (!serverHasToken) {
        window.localStorage.setItem(TOKEN_KEY, token)
        window.localStorage.setItem(ENV_KEY, environment)
      }
      const r = await api.post<SyncResp>("/api/integrations/square/sync", {
        // Server prefers env values; only send body fields when the
        // user is supplying them via the in-page form.
        ...(serverHasToken
          ? {}
          : { access_token: token, environment }),
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

  const importAnyway = async (s: Suggestion) => {
    if (!accountId || !categoryId) {
      toast.error("Pick a deposit account and an income category first")
      return
    }
    setOverriding(true)
    try {
      await api.post<{ created: number }>(
        "/api/integrations/square/import",
        {
          account_id: accountId,
          category_id: categoryId,
          invoices: [
            {
              square_id: s.square_id,
              description: s.description,
              amount: s.amount,
              paid_at: s.paid_at,
            },
          ],
        },
      )
      invalidateCachePrefix("transactions:")
      invalidateCachePrefix("dashboard:")
      toast.success("Imported as new deposit")
      setInspect(null)
      await sync()
    } catch (e) {
      const m = e instanceof Error ? e.message : "Import failed"
      toast.error(m)
    } finally {
      setOverriding(false)
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
      <div className="flex items-center justify-end">
        <Button intent="outline" size="sm" onPress={() => setSearchOpen(true)}>
          Search transactions
        </Button>
      </div>
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
          {serverHasToken ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="font-medium">Server credentials configured</div>
              <p className="text-xs text-muted-fg">
                Using <code>SQUARE_ACCESS_TOKEN</code> from <code>.env.local</code>{" "}
                ({environment}). To override for this session, clear it on the
                server.
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
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
                      <TableRow
                        id={s.square_id}
                        onAction={() =>
                          setInspect(
                            existing.find(
                              (e) => e.square_id === s.square_id,
                            ) ?? null,
                          )
                        }
                      >
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

      <ModalContent
        size="lg"
        isOpen={inspect !== null}
        onOpenChange={(v) => {
          if (!v && !overriding) setInspect(null)
        }}
      >
        {inspect && (
          <>
            <ModalHeader>
              <ModalTitle>Matched transaction</ModalTitle>
            </ModalHeader>
            <ModalBody className="grid gap-4 text-sm">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-fg">
                  Square invoice
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-2.5">
                  <div className="font-medium">{inspect.title}</div>
                  <div className="text-xs text-muted-fg">
                    Paid {inspect.paid_at} · {fmtMoney(inspect.amount)}
                    {inspect.invoice_number
                      ? ` · #${inspect.invoice_number}`
                      : ""}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-fg">
                  Local deposit (matched within ±7 days, exact amount)
                </div>
                {inspect.matched ? (
                  <div className="rounded-md border bg-muted/30 px-3 py-2.5">
                    <div className="font-medium">
                      {inspect.matched.description}
                    </div>
                    <div className="text-xs text-muted-fg">
                      {inspect.matched.date} ·{" "}
                      {fmtMoney(inspect.matched.amount)}
                      {inspect.matched.reference
                        ? ` · ref: ${inspect.matched.reference}`
                        : ""}
                    </div>
                    <a
                      href={`/transactions?focus=${inspect.matched.id}`}
                      className="mt-2 inline-block text-xs underline"
                    >
                      Open transaction →
                    </a>
                  </div>
                ) : (
                  <div className="text-xs text-muted-fg">
                    No local match details available.
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-fg">
                If the local transaction isn&rsquo;t actually this Square
                invoice, click <strong>Import anyway</strong> to record a
                new deposit. The existing one stays untouched.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                intent="outline"
                onPress={() => setInspect(null)}
                isDisabled={overriding}
              >
                Close
              </Button>
              <Button
                onPress={() => importAnyway(inspect)}
                isPending={overriding}
              >
                Import anyway
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>

      <ModalContent
        size="2xl"
        isOpen={searchOpen}
        onOpenChange={(v) => setSearchOpen(v)}
      >
        <ModalHeader>
          <ModalTitle>Search local transactions</ModalTitle>
        </ModalHeader>
        <ModalBody className="grid gap-3">
          <TextField value={searchQ} onChange={setSearchQ} autoFocus>
            <Label className="sr-only">Search</Label>
            <Input placeholder="Search by description, reference, amount…" />
          </TextField>
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table aria-label="Local transactions">
              <IntentTableHeader>
                <TableColumn id="date">Date</TableColumn>
                <TableColumn id="desc" isRowHeader className="w-full">
                  Description
                </TableColumn>
                <TableColumn id="type">Type</TableColumn>
                <TableColumn id="amt">Amount</TableColumn>
              </IntentTableHeader>
              <TableBody
                items={searchRows.map((r) => ({ ...r, id: r.id }))}
                renderEmptyState={() => (
                  <div className="p-8 text-center text-sm text-muted-fg">
                    {searchLoading
                      ? "Searching…"
                      : searchQ
                        ? "No matches."
                        : "Type to search your transactions."}
                  </div>
                )}
              >
                {(r: any) => {
                  const t = r.transactionType ?? r.transaction_type
                  return (
                    <TableRow id={r.id}>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {r.date}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.description}</div>
                        {r.reference && (
                          <div className="text-xs text-muted-fg">
                            {r.reference}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          intent={
                            t === "deposit"
                              ? "success"
                              : t === "withdrawal"
                                ? "danger"
                                : "info"
                          }
                        >
                          {String(t).replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {fmtMoney(Number(r.amount))}
                      </TableCell>
                    </TableRow>
                  )
                }}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-fg">
            Showing the first 50 results. Read-only — for full editing,
            use the Transactions page.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button intent="outline" onPress={() => setSearchOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </div>
  )
}

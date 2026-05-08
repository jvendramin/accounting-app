"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/field"
import {
  ComboBox,
  ComboBoxContent,
  ComboBoxInput,
  ComboBoxItem,
} from "@/components/ui/combo-box"
import { toast } from "sonner"
import { titleCase } from "@/lib/format"
import { api } from "@/lib/api"
import {
  parseWaveCsv,
  type WaveAccountSummary,
  type WaveLine,
  type WaveParseResult,
} from "@/lib/wave-import"
import { invalidateCachePrefix, invalidateCache } from "@/hooks/use-cached-fetch"

const ACCT_TYPES = [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
] as const
type AcctType = (typeof ACCT_TYPES)[number]

export default function WaveIntegrationPage() {
  const router = useRouter()
  return (
    // [&_*]:min-w-0 — every descendant inherits min-width:0 so no
    // intrinsic-content child can push a flex/grid ancestor wider than
    // the viewport. [&_*]:[overflow-wrap:anywhere] — long unbreakable
    // strings (filenames, account names) wrap mid-character instead of
    // forcing layout to grow.
    <div className="grid w-full max-w-full gap-4 overflow-x-clip [&_*]:min-w-0 [&_*]:[overflow-wrap:anywhere]">
      <div className="flex flex-col gap-2">
        <Button
          intent="plain"
          size="sm"
          onPress={() => router.push("/integrations")}
          className="self-start -ml-2"
        >
          ← Integrations
        </Button>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/integrations/wave.png"
            alt="Wave"
            className="size-12 shrink-0 overflow-hidden rounded-xl border bg-bg shadow-xs sm:size-14 object-contain"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Wave Accounting
            </h1>
            <p className="text-sm text-muted-fg">
              Bring your books over from Wave in one shot.
            </p>
          </div>
        </div>
      </div>

      <Tabs aria-label="Wave import sections" className="w-full min-w-0">
        <TabList>
          <Tab id="transactions">Transactions</Tab>
          <Tab id="accounts">Accounts</Tab>
          <Tab id="categories">Categories</Tab>
        </TabList>
        <TabPanels className="w-full">
          <TabPanel id="transactions" className="pt-4 grid gap-4 w-full min-w-0">
            <TransactionsTab />
          </TabPanel>
          <TabPanel id="accounts" className="pt-4 w-full min-w-0">
            <ComingSoon
              title="Import accounts"
              copy="Bring your Wave Chart of Accounts over en masse — name, type, subtype, currency. Coming next."
            />
          </TabPanel>
          <TabPanel id="categories" className="pt-4 w-full min-w-0">
            <ComingSoon
              title="Import categories"
              copy="Map Wave's expense / income classifications onto Books categories. Coming next."
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  )
}

const SUSPENSE_NAME = "Suspense — Wave Import"

type ManualOverride = {
  include: boolean
  counterAccount: string // name of the offsetting account
}

function TransactionsTab() {
  const [filename, setFilename] = useState<string | null>(null)
  const [parsed, setParsed] = useState<WaveParseResult | null>(null)
  // Account-type overrides keyed by account name (lowercased).
  const [typeOverrides, setTypeOverrides] = useState<Record<string, AcctType>>(
    {},
  )
  // Per-skipped-row decisions: include + counter account.
  const [manualOverrides, setManualOverrides] = useState<
    Record<number, ManualOverride>
  >({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    accounts_created: number
    transactions_created: number
    lines_created: number
    skipped: { date: string; description: string; reason: string }[]
  } | null>(null)

  const onFile = async (f: File) => {
    setFilename(f.name)
    setResult(null)
    const text = await f.text()
    const r = parseWaveCsv(text)
    setParsed(r)
    setTypeOverrides({})
    setManualOverrides({})
  }

  const reset = () => {
    setFilename(null)
    setParsed(null)
    setTypeOverrides({})
    setManualOverrides({})
    setResult(null)
  }

  const accountTypeFor = (a: WaveAccountSummary): AcctType =>
    typeOverrides[a.name.toLowerCase()] ?? a.inferredType

  const totalsByType = useMemo(() => {
    if (!parsed) return null
    const counts: Record<AcctType, number> = {
      asset: 0,
      liability: 0,
      equity: 0,
      income: 0,
      expense: 0,
    }
    for (const a of parsed.accounts) counts[accountTypeFor(a)]++
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, typeOverrides])

  // Build synthetic transaction groups for the user-included skipped rows.
  // Each becomes a 2-line entry: original line on its existing side, the
  // counter-account on the opposite side.
  const manualGroups = useMemo(() => {
    if (!parsed) return [] as WaveParseResult["groups"]
    return parsed.ambiguous
      .map((line, i) => ({ line, i, ov: manualOverrides[i] }))
      .filter(({ ov }) => ov?.include && ov.counterAccount)
      .map(({ line, ov }) => {
        const counter: WaveLine = {
          account: ov!.counterAccount,
          date: line.date,
          description: line.description,
          side: line.side === "debit" ? "credit" : "debit",
          amount: line.amount,
        }
        const debits = line.side === "debit" ? [line] : [counter]
        const credits = line.side === "credit" ? [line] : [counter]
        return {
          date: line.date,
          description: line.description || "(manual entry)",
          amount: line.amount,
          debits,
          credits,
          balanced: true,
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, manualOverrides])

  // Counter-account names referenced by manual entries that aren't in the
  // detected accounts list — we send them to the API so they get created.
  const extraAccounts = useMemo(() => {
    if (!parsed) return [] as { name: string; type: AcctType }[]
    const known = new Set(parsed.accounts.map((a) => a.name.toLowerCase()))
    const seen = new Set<string>()
    const out: { name: string; type: AcctType }[] = []
    for (const g of manualGroups) {
      for (const l of [...g.debits, ...g.credits]) {
        const key = l.account.toLowerCase()
        if (known.has(key) || seen.has(key)) continue
        seen.add(key)
        out.push({
          name: l.account,
          type: l.account === SUSPENSE_NAME ? "asset" : "asset",
        })
      }
    }
    return out
  }, [parsed, manualGroups])

  const commit = async () => {
    if (!parsed) return
    setSubmitting(true)
    try {
      const payload = {
        accounts: [
          ...parsed.accounts.map((a) => ({
            name: a.name,
            type: accountTypeFor(a),
          })),
          ...extraAccounts,
        ],
        groups: [...parsed.groups, ...manualGroups].map((g) => ({
          date: g.date,
          description: g.description,
          amount: g.amount,
          debits: g.debits.map((l) => ({
            account: l.account,
            amount: l.amount,
          })),
          credits: g.credits.map((l) => ({
            account: l.account,
            amount: l.amount,
          })),
        })),
        reference: `Wave import ${new Date().toISOString().slice(0, 10)}`,
      }
      const res = await api.post<typeof result extends infer T ? T : never>(
        "/api/integrations/wave/import",
        payload,
      )
      setResult(res as any)
      invalidateCachePrefix("transactions:")
      invalidateCache(
        "accounts:all",
        "dashboard:reports/profit_and_loss",
        "dashboard:reports/cashflow",
        "dashboard:suggestions",
      )
      toast.success(
        `Imported ${(res as any).transactions_created} transaction${
          (res as any).transactions_created === 1 ? "" : "s"
        }`,
      )
    } catch {
      /* api helper toasts */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Step 1 — Export from Wave
          </CardTitle>
          <CardDescription>
            Wave doesn't expose a transaction-level public API, so the
            migration uses their CSV export.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <ol className="grid gap-2 list-decimal pl-5">
            <li>
              In Wave, open <span className="font-medium">Reports</span> →{" "}
              <span className="font-medium">
                Account Transactions (General Ledger)
              </span>
              .
            </li>
            <li>
              Set the <span className="font-medium">Date Range</span> to a
              custom range covering everything you want to migrate.
            </li>
            <li>
              Click <span className="font-medium">Export → CSV</span>.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Step 2 — Upload &amp; preview
          </CardTitle>
          <CardDescription>
            We parse the CSV in your browser, infer account types, and pair
            each entry into a balanced transaction. Nothing is written to the
            database until you confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!parsed ? (
            <FileDrop onFile={onFile} />
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-col gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm sm:flex-row sm:items-center">
                <span className="truncate font-medium sm:min-w-0 sm:flex-1">
                  {filename}
                </span>
                <Button
                  intent="plain"
                  size="sm"
                  onPress={reset}
                  className="self-start sm:self-auto"
                >
                  Change file
                </Button>
              </div>
              <SummaryStats
                accounts={parsed.accounts.length}
                groups={parsed.groups.length}
                ambiguous={parsed.ambiguous.length}
                totals={totalsByType ?? undefined}
              />
              {parsed.warnings.length > 0 && (
                <div className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-fg">
                  <ul className="list-disc pl-5">
                    {parsed.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              Chart of accounts ({parsed.accounts.length})
            </CardTitle>
            <CardDescription>
              We infer each account's type from its name and activity. Adjust
              anything that looks wrong before committing.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid w-full min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-3 sm:gap-y-1.5 sm:items-center">
              <div className="hidden text-xs font-medium text-muted-fg sm:contents">
                <div>Name</div>
                <div className="text-right">Balance</div>
                <div>Type</div>
              </div>
              {parsed.accounts.map((a) => (
                <AccountRow
                  key={a.name}
                  acct={a}
                  type={accountTypeFor(a)}
                  onTypeChange={(t) =>
                    setTypeOverrides((prev) => ({
                      ...prev,
                      [a.name.toLowerCase()]: t,
                    }))
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {parsed && parsed.ambiguous.length > 0 && (
        <SkippedRowsCard
          parsed={parsed}
          manualOverrides={manualOverrides}
          setManualOverrides={setManualOverrides}
        />
      )}

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              Step {parsed.ambiguous.length > 0 ? 4 : 3} — Commit
            </CardTitle>
            <CardDescription>
              Creates the missing accounts and posts each balanced transaction
              with its journal lines. Existing accounts (matched by name) are
              left alone.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {result ? (
              <ResultSummary result={result} />
            ) : (
              <Button
                onPress={commit}
                isPending={submitting}
                isDisabled={parsed.groups.length + manualGroups.length === 0}
                className="w-full sm:w-auto"
              >
                Import {parsed.groups.length + manualGroups.length} transaction
                {parsed.groups.length + manualGroups.length === 1 ? "" : "s"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------

function FileDrop({ onFile }: { onFile: (f: File) => void }) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
      className={
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed bg-muted/20 px-4 py-10 text-center text-sm transition " +
        (dragOver ? "border-primary bg-primary-subtle/30" : "border-border")
      }
    >
      <span className="font-medium">Drop your Wave CSV here</span>
      <span className="text-xs text-muted-fg">or tap to choose a file</span>
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
    </label>
  )
}

function SummaryStats({
  accounts,
  groups,
  ambiguous,
  totals,
}: {
  accounts: number
  groups: number
  ambiguous: number
  totals?: Record<AcctType, number>
}) {
  return (
    <div className="grid w-full min-w-0 gap-2 sm:grid-cols-3">
      <Stat label="Accounts" value={accounts} />
      <Stat label="Transactions to create" value={groups} />
      <Stat
        label="Skipped lines"
        value={ambiguous}
        intent={ambiguous > 0 ? "warning" : "success"}
      />
      {totals && (
        <div className="flex w-full min-w-0 flex-wrap gap-1.5 sm:col-span-3">
          {ACCT_TYPES.filter((t) => totals[t] > 0).map((t) => (
            <Badge key={t} intent="secondary">
              {totals[t]} {titleCase(t)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  intent,
}: {
  label: string
  value: number
  intent?: "warning" | "success"
}) {
  return (
    <div className="rounded-md border bg-bg px-3 py-2">
      <div className="text-xs text-muted-fg">{label}</div>
      <div
        className={
          "text-lg font-semibold tabular-nums " +
          (intent === "warning"
            ? "text-warning-subtle-fg"
            : intent === "success"
              ? "text-success-subtle-fg"
              : "")
        }
      >
        {value}
      </div>
    </div>
  )
}

function AccountRow({
  acct,
  type,
  onTypeChange,
}: {
  acct: WaveAccountSummary
  type: AcctType
  onTypeChange: (t: AcctType) => void
}) {
  return (
    <div className="grid min-w-0 gap-1 rounded-md border bg-muted/10 p-3 sm:grid-cols-subgrid sm:col-span-3 sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
      <div className="min-w-0">
        <div className="truncate font-medium">{acct.name}</div>
        <div className="text-xs text-muted-fg sm:hidden">
          {fmt(acct.endingBalance)}
        </div>
      </div>
      <div className="hidden text-right tabular-nums text-sm sm:block">
        {fmt(acct.endingBalance)}
      </div>
      <div className="grid gap-1 sm:gap-0">
        <Label className="sm:hidden">Type</Label>
        <ComboBox
          aria-label={`Type for ${acct.name}`}
          selectedKey={type}
          onSelectionChange={(k) => k && onTypeChange(k as AcctType)}
          className="min-w-0 sm:w-[140px]"
        >
          <ComboBoxInput placeholder="Type" />
          <ComboBoxContent>
            {ACCT_TYPES.map((t) => (
              <ComboBoxItem key={t} id={t} textValue={titleCase(t)}>
                {titleCase(t)}
              </ComboBoxItem>
            ))}
          </ComboBoxContent>
        </ComboBox>
      </div>
    </div>
  )
}

function SkippedRowsCard({
  parsed,
  manualOverrides,
  setManualOverrides,
}: {
  parsed: WaveParseResult
  manualOverrides: Record<number, ManualOverride>
  setManualOverrides: React.Dispatch<
    React.SetStateAction<Record<number, ManualOverride>>
  >
}) {
  const accountOptions = useMemo(() => {
    const names = parsed.accounts.map((a) => a.name)
    return [SUSPENSE_NAME, ...names]
  }, [parsed.accounts])

  const includedCount = Object.values(manualOverrides).filter(
    (o) => o.include && o.counterAccount,
  ).length

  const includeAll = (counter: string) => {
    setManualOverrides((prev) => {
      const next: typeof prev = {}
      parsed.ambiguous.forEach((_, i) => {
        next[i] = { include: true, counterAccount: counter }
      })
      return next
    })
  }
  const skipAll = () => setManualOverrides({})

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">
          Step 3 — Review unpaired rows ({parsed.ambiguous.length})
        </CardTitle>
        <CardDescription>
          These lines couldn&apos;t be balanced automatically — usually
          one-sided opening entries, transfers Wave recorded oddly, or rounding
          artefacts. Pick a counter-account for each to include it as a
          single-sided journal entry, or leave it skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">
            {includedCount} of {parsed.ambiguous.length} included
          </span>
          <div className="ms-auto flex gap-2">
            <Button
              intent="outline"
              size="sm"
              onPress={() => includeAll(SUSPENSE_NAME)}
            >
              Include all → Suspense
            </Button>
            <Button intent="plain" size="sm" onPress={skipAll}>
              Skip all
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-x-3 sm:gap-y-1.5">
          <div className="hidden text-xs font-medium text-muted-fg sm:contents">
            <div>Include</div>
            <div>Account · Description · Date</div>
            <div className="text-right">Amount</div>
            <div>Counter account</div>
          </div>
          {parsed.ambiguous.map((line, i) => (
            <SkippedRow
              key={i}
              line={line}
              ov={manualOverrides[i]}
              accountOptions={accountOptions}
              onChange={(next) =>
                setManualOverrides((prev) => ({ ...prev, [i]: next }))
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SkippedRow({
  line,
  ov,
  accountOptions,
  onChange,
}: {
  line: WaveLine
  ov: ManualOverride | undefined
  accountOptions: string[]
  onChange: (ov: ManualOverride) => void
}) {
  const include = ov?.include ?? false
  const counter = ov?.counterAccount ?? SUSPENSE_NAME
  return (
    <div className="grid gap-2 rounded-md border bg-muted/10 p-3 sm:grid-cols-subgrid sm:col-span-4 sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label="Include this line"
          checked={include}
          onChange={(e) =>
            onChange({
              include: e.target.checked,
              counterAccount: counter,
            })
          }
          className="size-4 cursor-pointer accent-primary"
        />
        <span className="text-xs font-medium text-muted-fg sm:hidden">
          Include
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium">{line.account}</div>
        <div className="truncate text-xs text-muted-fg">
          {line.description || "(no description)"} · {line.date}
        </div>
      </div>
      <div className="text-sm tabular-nums sm:text-right">
        <span
          className={
            line.side === "debit"
              ? "text-success-subtle-fg"
              : "text-warning-subtle-fg"
          }
        >
          {line.side === "debit" ? "Dr" : "Cr"}{" "}
          {fmt(line.amount)}
        </span>
      </div>
      <ComboBox
        aria-label="Counter account"
        selectedKey={counter}
        onSelectionChange={(k) =>
          k &&
          onChange({
            include,
            counterAccount: String(k),
          })
        }
        isDisabled={!include}
      >
        <ComboBoxInput placeholder="Counter account" />
        <ComboBoxContent>
          {accountOptions.map((name) => (
            <ComboBoxItem key={name} id={name} textValue={name}>
              {name}
            </ComboBoxItem>
          ))}
        </ComboBoxContent>
      </ComboBox>
    </div>
  )
}

function ResultSummary({
  result,
}: {
  result: {
    accounts_created: number
    transactions_created: number
    lines_created: number
    skipped: { date: string; description: string; reason: string }[]
  }
}) {
  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-sm text-success-subtle-fg">
        Imported <strong>{result.transactions_created}</strong> transactions
        and <strong>{result.lines_created}</strong> journal lines. Created{" "}
        <strong>{result.accounts_created}</strong> new accounts.
      </div>
      {result.skipped.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-fg">
          <div className="font-medium">
            Skipped {result.skipped.length} transaction
            {result.skipped.length === 1 ? "" : "s"}:
          </div>
          <ul className="mt-1 list-disc pl-5">
            {result.skipped.slice(0, 8).map((s, i) => (
              <li key={i}>
                {s.date} — {s.description}: {s.reason}
              </li>
            ))}
            {result.skipped.length > 8 && (
              <li>… and {result.skipped.length - 8} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n)

function ComingSoon({ title, copy }: { title: string; copy: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        <CardDescription>{copy}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button intent="outline" isDisabled className="w-full sm:w-auto">
          Coming soon
        </Button>
      </CardContent>
    </Card>
  )
}

// Parser for Wave's "Account Transactions (General Ledger)" CSV export.
// Wave doesn't expose a per-transaction GL; instead each account is its own
// section listing one row per side of every entry. To reconstruct double-
// entry we group rows across sections by (date, normalised-description,
// |amount|) and pair debit-side rows with credit-side rows.

export type WaveSide = "debit" | "credit"

export interface WaveLine {
  account: string
  date: string // YYYY-MM-DD
  description: string
  side: WaveSide
  amount: number // always positive
}

export interface WaveAccountSummary {
  name: string
  endingDebit: number
  endingCredit: number
  endingBalance: number
  inferredType: "asset" | "liability" | "equity" | "income" | "expense"
}

export interface WaveTransactionGroup {
  date: string
  description: string
  amount: number // matched debit-side total = credit-side total
  debits: WaveLine[] // lines posted as debits
  credits: WaveLine[] // lines posted as credits
  balanced: boolean
}

export interface WaveParseResult {
  accounts: WaveAccountSummary[]
  groups: WaveTransactionGroup[] // balanced + commit-ready
  ambiguous: WaveLine[] // could not be paired; need a Suspense account
  warnings: string[]
}

// ---------------------------------------------------------------------------

const moneyRe = /^-?\$?[\d,]+(?:\.\d+)?$/
const parseMoney = (raw: string | undefined): number => {
  if (!raw) return 0
  const s = raw.replace(/[",$\s]/g, "")
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

// Lightweight CSV row splitter that respects double-quoted fields.
const splitCsvRow = (row: string): string[] => {
  const out: string[] = []
  let buf = ""
  let inQuote = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuote && row[i + 1] === '"') {
        buf += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (ch === "," && !inQuote) {
      out.push(buf)
      buf = ""
    } else {
      buf += ch
    }
  }
  out.push(buf)
  return out
}

// Heuristic: name + activity → account type.
function inferAccountType(
  name: string,
  endingDebit: number,
  endingCredit: number,
): WaveAccountSummary["inferredType"] {
  const n = name.toLowerCase()
  // Liability-ish names
  if (
    /payable/.test(n) ||
    /credit card|mastercard|visa/.test(n) ||
    /^gst$|^hst$|^pst$|tax payable/.test(n)
  )
    return "liability"
  // Equity-ish names
  if (/(retained earnings|owner.*equity|capital|drawings|dividends paid)/.test(n))
    return "equity"
  // Income-ish names
  if (
    /sales|revenue|income(?!.*expense)/.test(n) ||
    /cashback|refund|interest income/.test(n)
  )
    return "income"
  // Cash/bank
  if (
    /\b(rbc|cibc|td|bmo|chase|wells|wells fargo|bank|cash|float|venn|square|gusto|stripe|paypal|wise)\b/.test(
      n,
    )
  )
    return "asset"
  // Activity-based fallback
  // Mostly debits and not bank-like → expense
  if (endingDebit > 0 && endingCredit === 0) return "expense"
  if (endingCredit > 0 && endingDebit === 0) return "income"
  return endingBalance(endingDebit, endingCredit) >= 0 ? "asset" : "liability"
}

const endingBalance = (dr: number, cr: number) => dr - cr

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")

// ---------------------------------------------------------------------------

export function parseWaveCsv(csv: string): WaveParseResult {
  const warnings: string[] = []
  // Split lines but ignore blank trailing newline.
  const lines = csv.split(/\r?\n/)
  // Find the column-header row to know where data starts.
  const headerIdx = lines.findIndex((l) =>
    /ACCOUNT NUMBER,DATE,DESCRIPTION,DEBIT/i.test(l),
  )
  if (headerIdx < 0) {
    return {
      accounts: [],
      groups: [],
      ambiguous: [],
      warnings: ["Could not locate the column header row — is this Wave's Account Transactions CSV?"],
    }
  }

  // Walk the body, tracking the current account section.
  type AccPartial = {
    name: string
    endingDebit: number
    endingCredit: number
    endingBalance: number
    lines: WaveLine[]
  }
  const accounts: AccPartial[] = []
  let current: AccPartial | null = null

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw || raw === '""' || /^,*$/.test(raw)) continue
    const cols = splitCsvRow(raw)
    const [c0, c1, c2, c3, c4, c5] = cols
    // Section header: first cell empty, second cell is the account name, rest empty.
    if (c0 === "" && c1 && !c2 && !c3 && !c4 && !c5) {
      current = {
        name: c1.trim(),
        endingDebit: 0,
        endingCredit: 0,
        endingBalance: 0,
        lines: [],
      }
      accounts.push(current)
      continue
    }
    if (!current) continue
    if (c0 === "Starting Balance") continue
    if (c0 === "Totals and Ending Balance") {
      current.endingDebit = parseMoney(c3)
      current.endingCredit = parseMoney(c4)
      current.endingBalance = parseMoney(c5)
      continue
    }
    if (c0 === "Balance Change") continue
    // Data row: c0 may be empty (or an internal account number), c1=date, c2=desc, c3=debit, c4=credit
    if (!moneyRe.test((c3 || "").trim()) && !moneyRe.test((c4 || "").trim())) continue
    if (!c1 || !/^\d{4}-\d{2}-\d{2}$/.test(c1.trim())) continue
    const debit = parseMoney(c3)
    const credit = parseMoney(c4)
    if (debit === 0 && credit === 0) continue
    const side: WaveSide = debit > 0 ? "debit" : "credit"
    const amount = side === "debit" ? debit : credit
    current.lines.push({
      account: current.name,
      date: c1.trim(),
      description: (c2 ?? "").trim(),
      side,
      amount,
    })
  }

  // Finalise account summaries.
  const accountSummaries: WaveAccountSummary[] = accounts.map((a) => ({
    name: a.name,
    endingDebit: a.endingDebit,
    endingCredit: a.endingCredit,
    endingBalance: a.endingBalance,
    inferredType: inferAccountType(a.name, a.endingDebit, a.endingCredit),
  }))

  // Pair lines into transaction groups by (date, normalised description, |amount|).
  // We bucket on (date, |amount|) first and try to match a debit row with a
  // credit row whose normalised description is the same (or a substring).
  const allLines = accounts.flatMap((a) => a.lines)
  const buckets = new Map<string, WaveLine[]>()
  for (const ln of allLines) {
    const key = `${ln.date}|${ln.amount.toFixed(2)}`
    const arr = buckets.get(key)
    if (arr) arr.push(ln)
    else buckets.set(key, [ln])
  }

  const groups: WaveTransactionGroup[] = []
  const leftover: WaveLine[] = [] // didn't pair in the (date, |amount|) pass

  // ---- Pass 1: equal-amount debit ↔ credit pairing ----
  for (const arr of buckets.values()) {
    const debits = arr.filter((l) => l.side === "debit").slice()
    const credits = arr.filter((l) => l.side === "credit").slice()
    while (debits.length > 0 && credits.length > 0) {
      const d = debits[0]
      let cIdx = credits.findIndex((c) => norm(c.description) === norm(d.description))
      if (cIdx === -1) cIdx = 0
      const c = credits.splice(cIdx, 1)[0]
      debits.shift()
      groups.push({
        date: d.date,
        description: d.description || c.description,
        amount: d.amount,
        debits: [d],
        credits: [c],
        balanced: true,
      })
    }
    leftover.push(...debits, ...credits)
  }

  // ---- Pass 2: per-day compound JE balancing ----
  // Wave records compound entries (e.g. Sale: Cash dr 1000 / Sales cr 850 /
  // GST cr 150) as multiple rows whose individual amounts don't pair, but
  // whose totals balance within the day. Group leftovers by date; if the
  // day's debits sum equals the day's credits sum (within 1¢), bundle all
  // those rows into one compound JE.
  const byDate = new Map<string, WaveLine[]>()
  for (const ln of leftover) {
    const arr = byDate.get(ln.date)
    if (arr) arr.push(ln)
    else byDate.set(ln.date, [ln])
  }
  const ambiguous: WaveLine[] = []
  for (const [date, arr] of byDate) {
    const debits = arr.filter((l) => l.side === "debit")
    const credits = arr.filter((l) => l.side === "credit")
    const drTotal = debits.reduce((s, l) => s + l.amount, 0)
    const crTotal = credits.reduce((s, l) => s + l.amount, 0)
    if (
      debits.length > 0 &&
      credits.length > 0 &&
      Math.abs(drTotal - crTotal) < 0.01
    ) {
      // Use the description of the largest line for the parent transaction
      // (compound entries usually have one anchor line).
      const anchor = arr.reduce((a, b) => (b.amount > a.amount ? b : a))
      groups.push({
        date,
        description: anchor.description || "(compound entry)",
        amount: drTotal,
        debits,
        credits,
        balanced: true,
      })
    } else {
      ambiguous.push(...arr)
    }
  }

  // ---- Warnings ----
  // Phase 1+2 should resolve the vast majority of Wave exports. Only flag
  // when the remainder is genuinely orphaned (e.g. opening balances posted
  // outside the date range, manual one-sided journal entries).
  if (ambiguous.length > 0) {
    warnings.push(
      `${ambiguous.length} line(s) on ${
        new Set(ambiguous.map((l) => l.date)).size
      } day(s) couldn't be balanced automatically — usually one-sided opening entries or rounding artefacts. They'll be skipped on import; you can re-create them manually if needed.`,
    )
  }

  return { accounts: accountSummaries, groups, ambiguous, warnings }
}

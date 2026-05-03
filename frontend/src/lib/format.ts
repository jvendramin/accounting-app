export const fmtMoney = (n: number) =>
  Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" })

export const titleCaseType = (t: string) =>
  ({
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    journal_entry: "Journal Entry",
    receipt: "Receipt",
  } as Record<string, string>)[t] ?? t

export const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

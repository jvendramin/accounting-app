import { useEffect, useState } from "react"
import { Importer, ImporterField } from "react-csv-importer"
import "react-csv-importer/dist/index.css"
import "@/styles/csv-importer.css"
import { api, type Account } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { toast } from "sonner"

const ACCOUNTS_TEMPLATE_CSV = `name,account_type,code,description
Operating Cash,asset,1010,Primary checking account
Accounts Receivable,asset,1100,Customer invoices outstanding
Accounts Payable,liability,2010,Vendor bills outstanding
Owner Equity,equity,3000,Owner's equity account
Service Revenue,income,4000,Revenue from services
Office Expenses,expense,6010,General office costs
Software Subscriptions,expense,6020,SaaS tools
`

const TRANSACTIONS_TEMPLATE_CSV = `date,description,kind,account_name,category_name,amount,reference
2026-01-05,Client invoice payment,deposit,Operating Cash,Service Revenue,2500.00,INV-1001
2026-01-08,SaaS subscription,withdrawal,Operating Cash,Software Subscriptions,49.00,
2026-01-15,Office supplies,withdrawal,Operating Cash,Office Expenses,127.43,RCPT-882
2026-01-22,Consulting fee,deposit,Operating Cash,Service Revenue,1800.00,INV-1002
`

function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

type AccountRow = {
  name: string; code?: string; account_type: string; description?: string
}
type TxnRow = {
  date: string; description: string; reference?: string; kind: string
  account_name: string; category_name: string; amount: string
}

const lookup = (accounts: Account[], name?: string) => {
  if (!name) return undefined
  const n = name.trim().toLowerCase()
  return accounts.find((a) => a.name.toLowerCase() === n || a.code?.toLowerCase() === n)?.id
}

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tab, setTab] = useState("transactions")

  useEffect(() => { api.get("/accounts").then((r) => setAccounts(r.data)) }, [])

  const importAccounts = async (rows: AccountRow[]) => {
    const payload = { accounts: rows.map((r) => ({
      name: r.name, code: r.code, account_type: (r.account_type || "asset").toLowerCase(),
      description: r.description,
    })) }
    try {
      const res = await api.post("/accounts/bulk_create", payload)
      const { created, errors } = res.data
      const msg = `Imported ${created.length} account${created.length === 1 ? "" : "s"}${errors.length ? `, ${errors.length} error${errors.length === 1 ? "" : "s"}` : ""}`
      if (errors.length) {
        toast.warning(msg)
        console.warn(errors)
      } else {
        toast.success(msg)
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  const importTxns = async (rows: TxnRow[]) => {
    const transactions = rows.map((r) => {
      const kind = (r.kind || "deposit").toLowerCase().includes("with") ? "withdrawal" : "deposit"
      return {
        date: r.date, description: r.description, reference: r.reference, kind,
        account_id: lookup(accounts, r.account_name),
        category_id: lookup(accounts, r.category_name),
        amount: Number(r.amount),
      }
    })
    try {
      const res = await api.post("/transactions/bulk_create", { transactions })
      const { created, errors } = res.data
      const msg = `Imported ${created.length} transaction${created.length === 1 ? "" : "s"}${errors.length ? `, ${errors.length} error${errors.length === 1 ? "" : "s"}` : ""}`
      if (errors.length) {
        toast.warning(msg)
        console.warn(errors)
      } else {
        toast.success(msg)
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Import from CSV</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a CSV exported from another platform, then map your columns to the right fields.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <ToggleGroup
              value={tab}
              onValueChange={setTab}
              ariaLabel="Import type"
              className="w-full max-w-md"
              stretch
            >
              <ToggleGroupItem value="transactions">Transactions</ToggleGroupItem>
              <ToggleGroupItem value="accounts">Accounts</ToggleGroupItem>
            </ToggleGroup>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                tab === "transactions"
                  ? downloadCsv("transactions-template.csv", TRANSACTIONS_TEMPLATE_CSV)
                  : downloadCsv("accounts-template.csv", ACCOUNTS_TEMPLATE_CSV)
              }
            >
              <Download /> Download template
            </Button>
          </div>

          {tab === "transactions" && (
            <div className="pt-4">
              <Importer
                restartable
                processChunk={async (rows) => importTxns(rows as unknown as TxnRow[])}
              >
                <ImporterField name="date" label="Date" />
                <ImporterField name="description" label="Description" />
                <ImporterField name="kind" label="Kind (deposit / withdrawal)" />
                <ImporterField name="account_name" label="Account (cash/bank name or code)" />
                <ImporterField name="category_name" label="Category (income/expense name or code)" />
                <ImporterField name="amount" label="Amount" />
                <ImporterField name="reference" label="Reference" optional />
              </Importer>
            </div>
          )}

          {tab === "accounts" && (
            <div className="pt-4">
              <Importer
                restartable
                processChunk={async (rows) => importAccounts(rows as unknown as AccountRow[])}
              >
                <ImporterField name="name" label="Name" />
                <ImporterField name="account_type" label="Type (asset / liability / equity / income / expense)" />
                <ImporterField name="code" label="Code" optional />
                <ImporterField name="description" label="Description" optional />
              </Importer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

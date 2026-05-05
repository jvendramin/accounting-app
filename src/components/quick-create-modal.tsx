"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { toast } from "sonner"
import { titleCase } from "@/lib/format"
import { api, type Account } from "@/lib/api"
import { invalidateCache, invalidateCachePrefix } from "@/hooks/use-cached-fetch"

export type QuickType = "transaction" | "account" | "category" | null

const today = () => new Date().toISOString().slice(0, 10)

export function QuickCreateModal({
  type,
  onClose,
}: {
  type: QuickType
  onClose: () => void
}) {
  const isOpen = type !== null
  return (
    <ModalContent
      size="2xl"
      isOpen={isOpen}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      {type === "transaction" && <TxnForm onSaved={onClose} />}
      {type === "account" && <AccountForm onSaved={onClose} />}
      {type === "category" && <CategoryForm onSaved={onClose} />}
    </ModalContent>
  )
}

function TxnForm({ onSaved }: { onSaved: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  useEffect(() => {
    api.get<Account[]>("/api/accounts").then(setAccounts).catch(() => {})
  }, [])

  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "asset"),
    [accounts],
  )
  const incomeAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "income"),
    [accounts],
  )
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "expense"),
    [accounts],
  )

  const [date, setDate] = useState(today())
  const [description, setDescription] = useState("")
  const [reference, setReference] = useState("")
  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit")
  const [accountId, setAccountId] = useState<number | undefined>()
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [amount, setAmount] = useState(0)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!accountId || !categoryId || amount <= 0 || !description) {
      toast.error("Fill in account, category, amount, description")
      return
    }
    setBusy(true)
    try {
      const lines =
        kind === "deposit"
          ? [
              { account_id: accountId, debit: amount, credit: 0 },
              { account_id: categoryId, debit: 0, credit: amount },
            ]
          : [
              { account_id: categoryId, debit: amount, credit: 0 },
              { account_id: accountId, debit: 0, credit: amount },
            ]
      await api.post("/api/transactions", {
        transaction: {
          date,
          description,
          reference,
          transaction_type: kind,
          amount,
          journal_lines_attributes: lines,
        },
      })
      invalidateCachePrefix("transactions:")
      invalidateCache(
        "dashboard:reports/profit_and_loss",
        "dashboard:reports/cashflow",
        "dashboard:suggestions",
      )
      toast.success("Transaction created")
      onSaved()
    } catch {
      /* api helper toasts */
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ModalHeader>
        <ModalTitle>New transaction</ModalTitle>
      </ModalHeader>
      <ModalBody className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField value={date} onChange={setDate}>
            <Label>Date</Label>
            <Input type="date" />
          </TextField>
          <TextField value={reference} onChange={setReference}>
            <Label>Reference</Label>
            <Input placeholder="Optional" />
          </TextField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select
              aria-label="Kind"
              selectedKey={kind}
              onSelectionChange={(k) => setKind(k as "deposit" | "withdrawal")}
            >
              <SelectTrigger />
              <SelectContent>
                <SelectItem id="deposit">Deposit</SelectItem>
                <SelectItem id="withdrawal">Withdrawal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Account</Label>
            <Select
              aria-label="Account"
              selectedKey={accountId ? String(accountId) : undefined}
              onSelectionChange={(k) => setAccountId(Number(k))}
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
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            value={String(amount || "")}
            onChange={(v) => setAmount(Number(v) || 0)}
          >
            <Label>Amount</Label>
            <Input type="number" inputMode="decimal" step="0.01" />
          </TextField>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select
              aria-label="Category"
              selectedKey={categoryId ? String(categoryId) : undefined}
              onSelectionChange={(k) => setCategoryId(Number(k))}
            >
              <SelectTrigger />
              <SelectContent>
                {(kind === "deposit" ? incomeAccounts : expenseAccounts).map(
                  (a) => (
                    <SelectItem key={a.id} id={String(a.id)}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <TextField value={description} onChange={setDescription}>
          <Label>Description</Label>
          <Input placeholder="Write a description" />
        </TextField>
      </ModalBody>
      <ModalFooter className="pt-4 sm:pt-3">
        <Button intent="outline" onPress={onSaved} className="hidden sm:inline-flex">
          Cancel
        </Button>
        <Button onPress={save} isPending={busy}>
          Create
        </Button>
      </ModalFooter>
    </>
  )
}

function AccountForm({ onSaved }: { onSaved: () => void }) {
  const TYPES = ["asset", "liability", "equity", "income", "expense"] as const
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [accountType, setAccountType] = useState<(typeof TYPES)[number]>("asset")
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!name) {
      toast.error("Name is required")
      return
    }
    setBusy(true)
    try {
      await api.post("/api/accounts", {
        account: { name, code, account_type: accountType },
      })
      invalidateCache("accounts:all")
      toast.success("Account created")
      onSaved()
    } catch {
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <ModalHeader>
        <ModalTitle>New account</ModalTitle>
      </ModalHeader>
      <ModalBody className="grid gap-4">
        <TextField value={name} onChange={setName}>
          <Label>Name</Label>
          <Input />
        </TextField>
        <TextField value={code} onChange={setCode}>
          <Label>Code</Label>
          <Input />
        </TextField>
        <div className="grid gap-1.5">
          <Label>Type</Label>
          <Select
            aria-label="Type"
            selectedKey={accountType}
            onSelectionChange={(k) => setAccountType(k as (typeof TYPES)[number])}
          >
            <SelectTrigger />
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} id={t}>
                  {titleCase(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ModalBody>
      <ModalFooter className="pt-4 sm:pt-3">
        <Button intent="outline" onPress={onSaved} className="hidden sm:inline-flex">
          Cancel
        </Button>
        <Button onPress={save} isPending={busy}>
          Create
        </Button>
      </ModalFooter>
    </>
  )
}

function CategoryForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"income" | "expense">("expense")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!name) {
      toast.error("Name is required")
      return
    }
    setBusy(true)
    try {
      await api.post("/api/categories", {
        category: { name, kind, description },
      })
      toast.success("Category created")
      onSaved()
    } catch {
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <ModalHeader>
        <ModalTitle>New category</ModalTitle>
      </ModalHeader>
      <ModalBody className="grid gap-4">
        <TextField value={name} onChange={setName}>
          <Label>Name</Label>
          <Input />
        </TextField>
        <div className="grid gap-1.5">
          <Label>Kind</Label>
          <Select
            aria-label="Kind"
            selectedKey={kind}
            onSelectionChange={(k) => setKind(k as "income" | "expense")}
          >
            <SelectTrigger />
            <SelectContent>
              <SelectItem id="income">Income</SelectItem>
              <SelectItem id="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TextField value={description} onChange={setDescription}>
          <Label>Description</Label>
          <Input />
        </TextField>
      </ModalBody>
      <ModalFooter className="pt-4 sm:pt-3">
        <Button intent="outline" onPress={onSaved} className="hidden sm:inline-flex">
          Cancel
        </Button>
        <Button onPress={save} isPending={busy}>
          Create
        </Button>
      </ModalFooter>
    </>
  )
}

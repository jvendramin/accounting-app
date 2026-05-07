"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { DatePicker, DatePickerTrigger } from "@/components/ui/date-picker"
import { parseDate } from "@internationalized/date"
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

type DraftSaver = () => Promise<boolean>

export function QuickCreateModal({
  type,
  onClose,
}: {
  type: QuickType
  onClose: () => void
}) {
  const isOpen = type !== null
  const [dirty, setDirty] = useState(false)
  const [closePrompt, setClosePrompt] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const draftSaverRef = useRef<DraftSaver | null>(null)

  // Reset dirty/prompt whenever the modal closes or switches form type.
  useEffect(() => {
    if (!isOpen) {
      setDirty(false)
      setClosePrompt(false)
      draftSaverRef.current = null
    }
  }, [isOpen, type])

  const attemptClose = () => {
    if (dirty) setClosePrompt(true)
    else onClose()
  }
  const discardAndClose = () => {
    setClosePrompt(false)
    onClose()
  }
  const saveDraftAndClose = async () => {
    if (!draftSaverRef.current) return
    setSavingDraft(true)
    try {
      const ok = await draftSaverRef.current()
      if (ok) {
        setClosePrompt(false)
        onClose()
      }
    } finally {
      setSavingDraft(false)
    }
  }

  return (
    <>
      <ModalContent
        size="2xl"
        isOpen={isOpen}
        onOpenChange={(v) => {
          if (!v) attemptClose()
        }}
      >
        {type === "transaction" && (
          <TxnForm
            onSaved={onClose}
            onCancel={attemptClose}
            onDirtyChange={setDirty}
            registerDraftSaver={(fn) => {
              draftSaverRef.current = fn
            }}
          />
        )}
        {type === "account" && (
          <AccountForm
            onSaved={onClose}
            onCancel={attemptClose}
            onDirtyChange={setDirty}
          />
        )}
        {type === "category" && (
          <CategoryForm
            onSaved={onClose}
            onCancel={attemptClose}
            onDirtyChange={setDirty}
          />
        )}
      </ModalContent>

      <ModalContent
        size="md"
        role="alertdialog"
        isOpen={closePrompt}
        onOpenChange={(v) => {
          if (!v) setClosePrompt(false)
        }}
      >
        <ModalHeader>
          <ModalTitle>
            {type === "transaction"
              ? "Save as draft?"
              : "Discard your changes?"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm">
            {type === "transaction"
              ? "You have unsaved progress. Save it as a draft to resume later, or discard your changes."
              : "You have unsaved progress. Closing now will discard it."}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            intent="outline"
            onPress={() => setClosePrompt(false)}
            className="hidden sm:inline-flex"
          >
            Keep editing
          </Button>
          <Button intent="danger" onPress={discardAndClose}>
            Discard
          </Button>
          {type === "transaction" && (
            <Button onPress={saveDraftAndClose} isPending={savingDraft}>
              Save as draft
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </>
  )
}

interface CommonFormProps {
  onSaved: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}

function TxnForm({
  onSaved,
  onCancel,
  onDirtyChange,
  registerDraftSaver,
}: CommonFormProps & { registerDraftSaver: (fn: DraftSaver) => void }) {
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

  const dirty =
    !!description ||
    !!reference ||
    amount > 0 ||
    accountId !== undefined ||
    categoryId !== undefined
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // Save current form state as a draft row. Returns true on success so the
  // parent close-flow knows whether to dismiss.
  useEffect(() => {
    registerDraftSaver(async () => {
      try {
        const payload = {
          tab: "simple",
          editingId: null,
          simple: {
            date,
            description,
            reference,
            kind,
            account_id: accountId,
            category_id: categoryId,
            amount,
          },
          journal: {
            date,
            description: "",
            reference: "",
            lines: [
              { account_id: undefined, debit: 0, credit: 0, memo: "" },
              { account_id: undefined, debit: 0, credit: 0, memo: "" },
            ],
          },
        }
        const name = description || `Draft ${new Date().toLocaleString()}`
        await api.post("/api/drafts", { draft: { name, payload } })
        toast.success("Saved as draft")
        return true
      } catch {
        return false
      }
    })
  }, [
    registerDraftSaver,
    date,
    description,
    reference,
    kind,
    accountId,
    categoryId,
    amount,
  ])

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
      onDirtyChange(false)
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
          <DatePicker
            value={date ? parseDate(date) : null}
            onChange={(d) => setDate(d ? d.toString() : "")}
          >
            <Label>Date</Label>
            <DatePickerTrigger />
          </DatePicker>
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
                    {`${a.code} — ${a.name}`}
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
                      {`${a.code} — ${a.name}`}
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
        <Button
          intent="outline"
          onPress={onCancel}
          className="hidden sm:inline-flex"
        >
          Cancel
        </Button>
        <Button onPress={save} isPending={busy}>
          Create
        </Button>
      </ModalFooter>
    </>
  )
}

function AccountForm({ onSaved, onCancel, onDirtyChange }: CommonFormProps) {
  const TYPES = ["asset", "liability", "equity", "income", "expense"] as const
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [accountType, setAccountType] = useState<(typeof TYPES)[number]>("asset")
  const [busy, setBusy] = useState(false)
  const dirty = !!name || !!code || accountType !== "asset"
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
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
      onDirtyChange(false)
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
        <Button
          intent="outline"
          onPress={onCancel}
          className="hidden sm:inline-flex"
        >
          Cancel
        </Button>
        <Button onPress={save} isPending={busy}>
          Create
        </Button>
      </ModalFooter>
    </>
  )
}

function CategoryForm({ onSaved, onCancel, onDirtyChange }: CommonFormProps) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"income" | "expense">("expense")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const dirty = !!name || !!description || kind !== "expense"
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
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
      onDirtyChange(false)
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
        <Button
          intent="outline"
          onPress={onCancel}
          className="hidden sm:inline-flex"
        >
          Cancel
        </Button>
        <Button onPress={save} isPending={busy}>
          Create
        </Button>
      </ModalFooter>
    </>
  )
}

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
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconPlus } from "@/components/icons"
import { toast } from "sonner"
import { fmtMoney, titleCase } from "@/lib/format"

type Account = {
  id: number
  name: string
  code?: string
  account_type: "asset" | "liability" | "equity" | "income" | "expense"
  description?: string
  balance: number
}

const TYPES = ["asset", "liability", "equity", "income", "expense"] as const

export default function AccountsPage() {
  const [rows, setRows] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [type, setType] = useState<string>("all")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Account> | null>(null)

  const load = () => {
    setLoading(true)
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setRows)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (type !== "all" && r.account_type !== type) return false
      if (!ql) return true
      return (
        (r.name ?? "").toLowerCase().includes(ql) ||
        (r.code ?? "").toLowerCase().includes(ql)
      )
    })
  }, [rows, q, type])

  const save = async () => {
    if (!editing?.name || !editing?.account_type) {
      toast.error("Name and type are required")
      return
    }
    const wasUpdate = !!editing.id
    const url = editing.id ? `/api/accounts/${editing.id}` : "/api/accounts"
    const res = await fetch(url, {
      method: editing.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: editing }),
    })
    if (!res.ok) {
      toast.error("Save failed")
      return
    }
    toast.success(wasUpdate ? "Account updated" : "Account created")
    setOpen(false)
    setEditing(null)
    load()
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this account?")) return
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Delete failed")
      return
    }
    load()
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card className="flex flex-1 min-h-0 flex-col">
        <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <CardTitle>Chart of Accounts</CardTitle>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <TextField
              aria-label="Search"
              value={q}
              onChange={setQ}
              className="w-full sm:w-72"
            >
              <Input placeholder="Search..." />
            </TextField>
            <Select
              aria-label="Type"
              selectedKey={type}
              onSelectionChange={(k) => setType(String(k))}
              className="w-[160px]"
            >
              <SelectTrigger />
              <SelectContent>
                <SelectItem id="all">All Types</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} id={t}>
                    {titleCase(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onPress={() => {
                setEditing({ account_type: "asset" })
                setOpen(true)
              }}
            >
              <IconPlus /> New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <Table aria-label="Accounts">
            <IntentTableHeader>
              <TableColumn id="code" isRowHeader>
                Code
              </TableColumn>
              <TableColumn id="name">Name</TableColumn>
              <TableColumn id="type">Type</TableColumn>
              <TableColumn id="balance">Balance</TableColumn>
              <TableColumn id="actions">{""}</TableColumn>
            </IntentTableHeader>
            <TableBody
              items={filtered}
              renderEmptyState={() => (
                <div className="p-8 text-center text-sm text-muted-fg">
                  {loading ? "Loading…" : "No accounts."}
                </div>
              )}
            >
              {(a) => (
                <TableRow
                  id={a.id}
                  onAction={() => {
                    setEditing(a)
                    setOpen(true)
                  }}
                >
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>
                    <Badge intent="secondary">{titleCase(a.account_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(a.balance)}
                  </TableCell>
                  <TableCell>
                    <Button
                      intent="plain"
                      size="sq-sm"
                      onPress={() => remove(a.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal isOpen={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>
              {editing?.id ? "Edit Account" : "New Account"}
            </ModalTitle>
          </ModalHeader>
          <div className="grid gap-4 px-6 py-4">
            <TextField
              value={editing?.name ?? ""}
              onChange={(v) => setEditing({ ...editing!, name: v })}
            >
              <Label>Name</Label>
              <Input />
            </TextField>
            <TextField
              value={editing?.code ?? ""}
              onChange={(v) => setEditing({ ...editing!, code: v })}
            >
              <Label>Code</Label>
              <Input />
            </TextField>
            <div className="grid gap-1.5">
              <Label>Type</Label>
            <Select
              aria-label="Type"
              selectedKey={editing?.account_type}
              onSelectionChange={(k) =>
                setEditing({
                  ...editing!,
                  account_type: k as Account["account_type"],
                })
              }
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
          </div>
          <ModalFooter>
            <Button intent="outline" onPress={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onPress={save}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

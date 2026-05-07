"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { TableBody } from "react-aria-components"
import { EllipsisVerticalIcon } from "@heroicons/react/16/solid"
import {
  Table,
  TableCell,
  TableColumn,
  TableHeader as IntentTableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { SearchField, SearchInput } from "@/components/ui/search-field"
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
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconPlus } from "@/components/icons"
import { toast } from "sonner"
import { fmtMoney, titleCase } from "@/lib/format"
import { BulkActionsBar, selectedIds } from "@/components/bulk-actions-bar"
import type { Selection } from "react-aria-components"

type Account = {
  id: number
  name: string
  code?: string
  account_type: "asset" | "liability" | "equity" | "income" | "expense"
  description?: string
  balance: number
}

const TYPES = ["asset", "liability", "equity", "income", "expense"] as const

type SortDesc = { column: string; direction: "ascending" | "descending" }

export default function AccountsPage() {
  const [rows, setRows] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [type, setType] = useState<string>("all")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Account> | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [sortDescriptor, setSortDescriptor] = useState<SortDesc>({
    column: "code",
    direction: "ascending",
  })
  const [selection, setSelection] = useState<Selection>(new Set())
  const bulkDelete = async () => {
    const ids = selectedIds(selection, rows)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} account${ids.length > 1 ? "s" : ""}?`))
      return
    const res = await fetch("/api/accounts/bulk_destroy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      setSelection(new Set())
      load()
      toast.success(`Deleted ${ids.length}`)
    } else {
      toast.error("Failed to delete")
    }
  }

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

  // Auto-open create modal when arriving via ?new=1 (Dashboard quick-create).
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing({ account_type: "asset" })
      setOpen(true)
      router.replace(pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let out = rows.filter((r) => {
      if (type !== "all" && r.account_type !== type) return false
      if (!ql) return true
      return (
        (r.name ?? "").toLowerCase().includes(ql) ||
        (r.code ?? "").toLowerCase().includes(ql)
      )
    })
    const { column, direction } = sortDescriptor
    out = [...out].sort((a, b) => {
      const av = (a as any)[column] ?? ""
      const bv = (b as any)[column] ?? ""
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv))
      return direction === "descending" ? -cmp : cmp
    })
    return out
  }, [rows, q, type, sortDescriptor])

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
          <div className="flex items-center justify-between gap-2 sm:contents">
            <CardTitle>Chart of Accounts</CardTitle>
            <div className="flex items-center gap-2 sm:hidden">
              <Button
                intent="outline"
                size="sm"
                onPress={() => setShowFilters((s) => !s)}
                aria-expanded={showFilters}
              >
                {showFilters ? "Hide" : "Filters"}
              </Button>
              <Button
                size="sm"
                onPress={() => {
                  setEditing({ account_type: "asset" })
                  setOpen(true)
                }}
              >
                <IconPlus />
              </Button>
            </div>
          </div>
          <div
            className={
              "flex flex-wrap items-center gap-2.5 w-full sm:w-auto " +
              (showFilters ? "flex" : "hidden sm:flex")
            }
          >
            <SearchField
              aria-label="Search"
              value={q}
              onChange={setQ}
              className="w-full sm:w-72"
            >
              <SearchInput placeholder="Search..." />
            </SearchField>
            <Select
              aria-label="Type"
              selectedKey={type}
              onSelectionChange={(k) => setType(String(k))}
              className="w-full sm:w-[160px]"
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
              className="hidden sm:inline-flex"
            >
              <IconPlus /> New
            </Button>
          </div>
        </CardHeader>
        <CardContent
          className="flex-1 overflow-auto px-4 py-0 [&_table]:min-w-[640px]"
          style={{ "--gutter": "1rem" } as React.CSSProperties}
        >
          <BulkActionsBar
            selection={selection}
            totalRows={filtered.length}
            onClear={() => setSelection(new Set())}
            onDelete={bulkDelete}
          />
          <Table
            allowResize
            aria-label="Accounts"
            selectionMode="multiple"
            selectedKeys={selection}
            onSelectionChange={(keys) =>
              setSelection(keys)
            }
            sortDescriptor={sortDescriptor}
            onSortChange={(d) => setSortDescriptor(d as SortDesc)}
          >
            <IntentTableHeader>
              <TableColumn id="code" isRowHeader allowsSorting isResizable>
                Code
              </TableColumn>
              <TableColumn id="name" allowsSorting isResizable className="w-full">
                Name
              </TableColumn>
              <TableColumn id="account_type" allowsSorting>
                Type
              </TableColumn>
              <TableColumn id="balance" allowsSorting>
                Balance
              </TableColumn>
              <TableColumn id="actions" width={56} minWidth={56} maxWidth={56}>
                {""}
              </TableColumn>
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
                <TableRow id={a.id}>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>
                    <Badge intent="secondary">{titleCase(a.account_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(a.balance)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Menu>
                        <MenuTrigger className="size-6">
                          <EllipsisVerticalIcon />
                        </MenuTrigger>
                        <MenuContent aria-label="Actions" placement="left top">
                          <MenuItem
                            onAction={() => {
                              setEditing(a)
                              setOpen(true)
                            }}
                          >
                            Edit
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem intent="danger" onAction={() => remove(a.id)}>
                            Delete
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ModalContent size="2xl" isOpen={open} onOpenChange={setOpen}>
          <ModalHeader>
            <ModalTitle>
              {editing?.id ? "Edit Account" : "New Account"}
            </ModalTitle>
          </ModalHeader>
          <ModalBody className="grid gap-4">
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
          </ModalBody>
          <ModalFooter className="pt-4 sm:pt-3">
            <Button
              intent="outline"
              onPress={() => setOpen(false)}
              className="hidden sm:inline-flex"
            >
              Cancel
            </Button>
            <Button onPress={save}>Save</Button>
          </ModalFooter>
      </ModalContent>
    </div>
  )
}

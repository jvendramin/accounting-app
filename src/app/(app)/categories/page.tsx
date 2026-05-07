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
  ComboBox,
  ComboBoxContent,
  ComboBoxInput,
  ComboBoxItem,
} from "@/components/ui/combo-box"
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
import { titleCase } from "@/lib/format"
import { BulkActionsBar, selectedIds } from "@/components/bulk-actions-bar"
import type { Selection } from "react-aria-components"

type Category = {
  id: number
  name: string
  kind: "income" | "expense"
  color?: string | null
  description?: string | null
}

const KINDS = ["income", "expense"] as const

type SortDesc = { column: string; direction: "ascending" | "descending" }

export default function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<string>("all")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [sortDescriptor, setSortDescriptor] = useState<SortDesc>({
    column: "name",
    direction: "ascending",
  })
  const [selection, setSelection] = useState<Selection>(new Set())
  const bulkDelete = async () => {
    const ids = selectedIds(selection, rows)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} categor${ids.length > 1 ? "ies" : "y"}?`))
      return
    const res = await fetch("/api/categories/bulk_destroy", {
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
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setRows)
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing({ kind: "expense" })
      setOpen(true)
      router.replace(pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let out = rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false
      if (!ql) return true
      return (r.name ?? "").toLowerCase().includes(ql)
    })
    const { column, direction } = sortDescriptor
    out = [...out].sort((a, b) => {
      const av = (a as any)[column] ?? ""
      const bv = (b as any)[column] ?? ""
      const cmp = String(av).localeCompare(String(bv))
      return direction === "descending" ? -cmp : cmp
    })
    return out
  }, [rows, q, kind, sortDescriptor])

  const save = async () => {
    if (!editing?.name || !editing?.kind) {
      toast.error("Name and kind are required")
      return
    }
    const wasUpdate = !!editing.id
    const url = editing.id ? `/api/categories/${editing.id}` : "/api/categories"
    const res = await fetch(url, {
      method: editing.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: editing }),
    })
    if (!res.ok) {
      toast.error("Save failed")
      return
    }
    toast.success(wasUpdate ? "Category updated" : "Category created")
    setOpen(false)
    setEditing(null)
    load()
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this category?")) return
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" })
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
            <CardTitle>Categories</CardTitle>
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
                  setEditing({ kind: "expense" })
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
              className="w-full sm:w-56"
            >
              <SearchInput placeholder="Search..." />
            </SearchField>
            <ComboBox
              aria-label="Kind"
              selectedKey={kind}
              onSelectionChange={(k) => setKind(k == null ? "all" : String(k))}
              className="w-full sm:w-[160px]"
            >
              <ComboBoxInput placeholder="All" />
              <ComboBoxContent>
                <ComboBoxItem id="all">All</ComboBoxItem>
                {KINDS.map((k) => (
                  <ComboBoxItem key={k} id={k} textValue={titleCase(k)}>
                    {titleCase(k)}
                  </ComboBoxItem>
                ))}
              </ComboBoxContent>
            </ComboBox>
            <Button
              onPress={() => {
                setEditing({ kind: "expense" })
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
            aria-label="Categories"
            selectionMode="multiple"
            selectedKeys={selection}
            onSelectionChange={(keys) =>
              setSelection(keys)
            }
            sortDescriptor={sortDescriptor}
            onSortChange={(d) => setSortDescriptor(d as SortDesc)}
          >
            <IntentTableHeader>
              <TableColumn id="name" isRowHeader allowsSorting isResizable className="w-full">
                Name
              </TableColumn>
              <TableColumn id="kind" allowsSorting>
                Kind
              </TableColumn>
              <TableColumn id="description" isResizable>
                Description
              </TableColumn>
              <TableColumn id="actions" width={56} minWidth={56} maxWidth={56}>
                {""}
              </TableColumn>
            </IntentTableHeader>
            <TableBody
              items={filtered}
              renderEmptyState={() => (
                <div className="p-8 text-center text-sm text-muted-fg">
                  {loading ? "Loading…" : "No categories."}
                </div>
              )}
            >
              {(c) => (
                <TableRow
                  id={c.id}
                  onAction={() => {
                    setEditing(c)
                    setOpen(true)
                  }}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge intent={c.kind === "income" ? "success" : "danger"}>
                      {titleCase(c.kind)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-fg">
                    {c.description}
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
                              setEditing(c)
                              setOpen(true)
                            }}
                          >
                            Edit
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem intent="danger" onAction={() => remove(c.id)}>
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
          <ModalTitle>{editing?.id ? "Edit Category" : "New Category"}</ModalTitle>
        </ModalHeader>
        <ModalBody className="grid gap-4">
          <TextField
            value={editing?.name ?? ""}
            onChange={(v) => setEditing({ ...editing!, name: v })}
          >
            <Label>Name</Label>
            <Input />
          </TextField>
          <ComboBox
            aria-label="Kind"
            selectedKey={editing?.kind ?? null}
            onSelectionChange={(k) =>
              k && setEditing({ ...editing!, kind: k as Category["kind"] })
            }
          >
            <Label>Kind</Label>
            <ComboBoxInput placeholder="Select kind" />
            <ComboBoxContent>
              {KINDS.map((k) => (
                <ComboBoxItem key={k} id={k} textValue={titleCase(k)}>
                  {titleCase(k)}
                </ComboBoxItem>
              ))}
            </ComboBoxContent>
          </ComboBox>
          <TextField
            value={editing?.description ?? ""}
            onChange={(v) => setEditing({ ...editing!, description: v })}
          >
            <Label>Description</Label>
            <Input />
          </TextField>
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

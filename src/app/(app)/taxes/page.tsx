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
import { BulkActionsBar, selectedIds } from "@/components/bulk-actions-bar"
import {
  TablePagination,
  paginate,
  usePage,
  usePageSize,
} from "@/components/table-pagination"
import { NumberField, NumberInput } from "@/components/ui/number-field"
import { Switch } from "@/components/ui/switch"
import type { Selection } from "react-aria-components"

type Tax = {
  id: number
  name: string
  rate: number
  description?: string | null
  is_active: boolean
}

const fmtPercent = (r: number) => `${(r * 100).toFixed(2)}%`

export default function TaxesPage() {
  const [rows, setRows] = useState<Tax[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Tax> | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [selection, setSelection] = useState<Selection>(new Set())
  const [pageSize, setPageSize] = usePageSize()
  const bulkDelete = async () => {
    const ids = selectedIds(selection, rows)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} tax${ids.length > 1 ? "es" : ""}?`)) return
    const res = await fetch("/api/taxes/bulk_destroy", {
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
    fetch("/api/taxes")
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
      setEditing({ rate: 0.05, is_active: true })
      setOpen(true)
      router.replace(pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const [page, setPage] = usePage([q, pageSize])
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) =>
      ql ? (r.name ?? "").toLowerCase().includes(ql) : true,
    )
  }, [rows, q])

  const save = async () => {
    if (!editing?.name || editing.rate == null) {
      toast.error("Name and rate are required")
      return
    }
    const wasUpdate = !!editing.id
    const url = editing.id ? `/api/taxes/${editing.id}` : "/api/taxes"
    const res = await fetch(url, {
      method: editing.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tax: {
          name: editing.name,
          rate: Number(editing.rate),
          description: editing.description ?? null,
          is_active: editing.is_active ?? true,
        },
      }),
    })
    if (!res.ok) {
      toast.error("Save failed")
      return
    }
    toast.success(wasUpdate ? "Tax updated" : "Tax created")
    setOpen(false)
    setEditing(null)
    load()
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this tax?")) return
    const res = await fetch(`/api/taxes/${id}`, { method: "DELETE" })
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
            <CardTitle>Taxes</CardTitle>
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
                  setEditing({ rate: 0.05, is_active: true })
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
            <Button
              onPress={() => {
                setEditing({ rate: 0.05, is_active: true })
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
            exportFilename={`taxes-${new Date().toISOString().slice(0, 10)}`}
            getExportRows={() => {
              const ids = new Set(selectedIds(selection, filtered))
              return filtered
                .filter((t) => ids.has(t.id))
                .map((t) => ({
                  id: t.id,
                  name: t.name,
                  rate: t.rate,
                  description: t.description ?? "",
                  is_active: t.is_active,
                }))
            }}
          />
          <Table
            aria-label="Taxes"
            selectionMode="multiple"
            selectedKeys={selection}
            onSelectionChange={(keys) =>
              setSelection(keys)
            }
          >
            <IntentTableHeader>
              <TableColumn id="name" isRowHeader className="w-full">
                Name
              </TableColumn>
              <TableColumn id="rate">Rate</TableColumn>
              <TableColumn id="status">Status</TableColumn>
              <TableColumn id="actions" width={56} minWidth={56} maxWidth={56}>
                {""}
              </TableColumn>
            </IntentTableHeader>
            <TableBody
              items={paginate(filtered, page, pageSize)}
              renderEmptyState={() => (
                <div className="p-8 text-center text-sm text-muted-fg">
                  {loading ? "Loading…" : "No taxes."}
                </div>
              )}
            >
              {(t) => (
                <TableRow
                  id={t.id}
                  onAction={() => {
                    setEditing(t)
                    setOpen(true)
                  }}
                >
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="tabular-nums">{fmtPercent(t.rate)}</TableCell>
                  <TableCell>
                    <Badge intent={t.is_active ? "success" : "secondary"}>
                      {t.is_active ? "Active" : "Inactive"}
                    </Badge>
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
                              setEditing(t)
                              setOpen(true)
                            }}
                          >
                            Edit
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem intent="danger" onAction={() => remove(t.id)}>
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
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      <ModalContent size="2xl" isOpen={open} onOpenChange={setOpen}>
        <ModalHeader>
          <ModalTitle>{editing?.id ? "Edit tax" : "New tax"}</ModalTitle>
        </ModalHeader>
        <ModalBody className="grid gap-4">
          <TextField
            value={editing?.name ?? ""}
            onChange={(v) => setEditing({ ...editing!, name: v })}
          >
            <Label>Name</Label>
            <Input placeholder="e.g. GST" />
          </TextField>
          <NumberField
            value={editing?.rate != null ? editing.rate * 100 : 0}
            onChange={(v) =>
              setEditing({
                ...editing!,
                rate: Number.isFinite(v) ? v / 100 : 0,
              })
            }
            minValue={0}
            step={0.01}
            formatOptions={{ style: "decimal", minimumFractionDigits: 2 }}
          >
            <Label>Rate (%)</Label>
            <NumberInput />
          </NumberField>
          <TextField
            value={editing?.description ?? ""}
            onChange={(v) => setEditing({ ...editing!, description: v })}
          >
            <Label>Description</Label>
            <Input />
          </TextField>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-fg">
                Inactive taxes are hidden from the transaction picker.
              </div>
            </div>
            <Switch
              isSelected={editing?.is_active ?? true}
              onChange={(v) => setEditing({ ...editing!, is_active: v })}
            />
          </div>
        </ModalBody>
        <ModalFooter className="pt-4 sm:pt-3">
          <Button intent="outline" onPress={() => setOpen(false)} className="hidden sm:inline-flex">
            Cancel
          </Button>
          <Button onPress={save}>Save</Button>
        </ModalFooter>
      </ModalContent>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { TableBody } from "react-aria-components"
import { EllipsisVerticalIcon } from "@heroicons/react/16/solid"
import {
  Table,
  TableCell,
  TableColumn,
  TableHeader as IntentTableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileUploader } from "@/components/file-uploader"
import {
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
} from "@/components/ui/modal"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import { IconPlus } from "@/components/icons"
import { toast } from "sonner"
import { auth } from "@/lib/auth"
import { api, type Receipt } from "@/lib/api"
import { invalidateCache, useCachedFetch } from "@/hooks/use-cached-fetch"

export default function ReceiptsPage() {
  const session = auth.useSession()
  const userSub = session.data?.user?.id ?? null

  const key = userSub ? `receipts:${userSub}` : "receipts:all"
  const { data, refetch } = useCachedFetch<Receipt[]>(key, () =>
    api.get("/api/receipts", userSub ? { user_sub: userSub } : {}),
  )
  const rawRows = data ?? []
  const [sortDescriptor, setSortDescriptor] = useState<{
    column: string
    direction: "ascending" | "descending"
  }>({ column: "created_at", direction: "descending" })
  const rows = useMemo(() => {
    const { column, direction } = sortDescriptor
    return [...rawRows].sort((a, b) => {
      const av: any = (a as any)[column] ?? ""
      const bv: any = (b as any)[column] ?? ""
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv))
      return direction === "descending" ? -cmp : cmp
    })
  }, [rawRows, sortDescriptor])

  const [uploadOpen, setUploadOpen] = useState(false)

  const onUploaded = async (file: {
    filename: string
    content_type: string
    byte_size: number
    storage_key: string
  }) => {
    try {
      await api.post("/api/receipts", {
        receipt: {
          filename: file.filename,
          content_type: file.content_type,
          byte_size: file.byte_size,
          storage_key: file.storage_key,
          uploader_sub: userSub ?? "anonymous",
        },
      })
      toast.success("Uploaded")
      invalidateCache(key)
      refetch()
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed")
    }
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this receipt?")) return
    await api.delete(`/api/receipts/${id}`)
    invalidateCache(key)
    refetch()
  }

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <CardTitle>Receipts</CardTitle>
        <Button onPress={() => setUploadOpen(true)}>
          <IconPlus /> Upload
        </Button>
      </CardHeader>
      <CardContent
        className="flex-1 overflow-auto px-4 py-0 [&_table]:min-w-[640px]"
        style={{ "--gutter": "1rem" } as React.CSSProperties}
      >
        <Table
          allowResize
          aria-label="Receipts"
          sortDescriptor={sortDescriptor}
          onSortChange={(d) =>
            setSortDescriptor(d as { column: string; direction: "ascending" | "descending" })
          }
          style={{ "--gutter": "1rem" } as React.CSSProperties}
        >
          <IntentTableHeader>
            <TableColumn id="filename" isRowHeader allowsSorting isResizable className="w-full">
              File
            </TableColumn>
            <TableColumn id="byte_size" allowsSorting>
              Size
            </TableColumn>
            <TableColumn id="content_type" allowsSorting isResizable>
              Type
            </TableColumn>
            <TableColumn id="created_at" allowsSorting>
              Uploaded
            </TableColumn>
            <TableColumn id="actions" width={56} minWidth={56} maxWidth={56}>
              {""}
            </TableColumn>
          </IntentTableHeader>
          <TableBody
            items={rows}
            renderEmptyState={() => (
              <div className="p-8 text-center text-sm text-muted-fg">
                No receipts yet.
              </div>
            )}
          >
            {(r) => (
              <TableRow id={r.id}>
                <TableCell className="font-medium">{r.filename}</TableCell>
                <TableCell className="tabular-nums">
                  {r.byte_size ? `${Math.round(r.byte_size / 1024)} KB` : "—"}
                </TableCell>
                <TableCell className="text-muted-fg">{r.content_type}</TableCell>
                <TableCell className="text-muted-fg">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Menu>
                      <MenuTrigger className="size-6">
                        <EllipsisVerticalIcon />
                      </MenuTrigger>
                      <MenuContent aria-label="Actions" placement="left top">
                        <MenuItem intent="danger" onAction={() => remove(r.id)}>
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

      <ModalContent
        size="2xl"
        isOpen={uploadOpen}
        onOpenChange={setUploadOpen}
      >
        <ModalHeader>
          <ModalTitle>Upload receipts</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <FileUploader
            userSub={userSub ?? "anonymous"}
            acceptedFileTypes={["image/*", "application/pdf"]}
            maxFileSize="20MB"
            onUploaded={onUploaded}
          />
        </ModalBody>
      </ModalContent>
    </Card>
  )
}

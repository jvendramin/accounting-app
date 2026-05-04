"use client"

import { useState } from "react"
import { TableBody } from "react-aria-components"
import {
  Table,
  TableCell,
  TableColumn,
  TableHeader as IntentTableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileTrigger } from "@/components/ui/file-trigger"
import { IconPlus, IconTrash } from "@/components/icons"
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
  const rows = data ?? []
  const [busy, setBusy] = useState(false)

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const presign = await api.post<{
          upload_url: string
          key: string
          public_url: string
        }>("/api/receipts/presign", {
          filename: file.name,
          content_type: file.type,
          user_sub: userSub ?? "anonymous",
        })
        const put = await fetch(presign.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        })
        if (!put.ok) throw new Error(`Upload failed: ${put.status}`)
        await api.post("/api/receipts", {
          receipt: {
            filename: file.name,
            content_type: file.type,
            byte_size: file.size,
            storage_key: presign.key,
            uploader_sub: userSub ?? "anonymous",
          },
        })
      }
      toast.success("Uploaded")
      invalidateCache(key)
      refetch()
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed")
    } finally {
      setBusy(false)
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
        <FileTrigger acceptedFileTypes={["image/*", "application/pdf"]} allowsMultiple onSelect={upload}>
          <Button isPending={busy}>
            <IconPlus /> Upload
          </Button>
        </FileTrigger>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        <Table aria-label="Receipts">
          <IntentTableHeader>
            <TableColumn id="filename" isRowHeader>File</TableColumn>
            <TableColumn id="size">Size</TableColumn>
            <TableColumn id="type">Type</TableColumn>
            <TableColumn id="date">Uploaded</TableColumn>
            <TableColumn id="act">{""}</TableColumn>
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
                  <Button intent="plain" size="sq-sm" onPress={() => remove(r.id)}>
                    <IconTrash />
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

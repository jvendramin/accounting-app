import { useEffect, useMemo, useState } from "react"
import { FilePond, registerPlugin } from "react-filepond"
import "filepond/dist/filepond.min.css"
import FilePondPluginImagePreview from "filepond-plugin-image-preview"
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css"
import FilePondPluginFileValidateSize from "filepond-plugin-file-validate-size"
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type"
import "@/styles/filepond.css"

import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type PaginationState,
  type Row,
} from "@tanstack/react-table"
import { api } from "@/lib/api"
import { auth } from "@/lib/auth"
import { withMinDelay } from "@/lib/loading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuGroup, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useAutoFitPageSize } from "@/hooks/use-auto-fit-page-size"
import {
  InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton,
} from "@/components/ui/input-group"
import { SearchIcon, XIcon, MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"
import {
  DataGrid,
  DataGridTable,
  DataGridScrollArea,
  DataGridPagination,
} from "@/components/reui/data-grid"
import {
  Frame, FramePanel, FrameHeader, FrameTitle, FrameFooter,
} from "@/components/reui/frame"

function ActionsCell<T extends { id: number | string }>({
  row, onEdit, onDelete,
}: { row: Row<T>; onEdit?: (r: T) => void; onDelete: (id: T["id"]) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="size-7" size="icon" variant="ghost"><MoreHorizontalIcon /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end">
        {onEdit && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <PencilIcon /> Edit
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original.id)}>
            <TrashIcon /> Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

registerPlugin(FilePondPluginImagePreview, FilePondPluginFileValidateSize, FilePondPluginFileValidateType)

type Receipt = {
  id: number; filename: string; url?: string; s3_key?: string
  size?: number; content_type?: string; created_at: string; transaction_id?: number
}

export default function Receipts() {
  const session = auth.useSession()
  const userSub = session.data?.user?.id ?? session.data?.session?.userId
  const [rows, setRows] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const { ref: panelRef } = useAutoFitPageSize(44, 40)

  const load = () => {
    setLoading(true)
    withMinDelay(api.get("/receipts"), 1000)
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const remove = async (id: number) => {
    if (!confirm("Delete?")) return
    try {
      await api.delete(`/receipts/${id}`)
      load()
      toast.error("Receipt deleted")
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  const columns = useMemo<ColumnDef<Receipt>[]>(() => [
    {
      accessorKey: "filename",
      header: "Filename",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.url
            ? <a className="underline" href={row.original.url} target="_blank" rel="noreferrer">{row.original.filename}</a>
            : row.original.filename}
        </span>
      ),
    },
    {
      accessorKey: "content_type",
      header: "Type",
      cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.original.content_type}</span>,
    },
    {
      accessorKey: "size",
      header: "Size",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.size ? `${(row.original.size / 1024).toFixed(1)} KB` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Uploaded",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">{new Date(row.original.created_at).toLocaleString()}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 60,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ActionsCell row={row} onDelete={(id) => remove(id as number)} />
        </div>
      ),
      enableSorting: false,
    },
  ], [])

  const filteredRows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return rows
    return rows.filter((r) =>
      (r.filename ?? "").toLowerCase().includes(ql) ||
      (r.content_type ?? "").toLowerCase().includes(ql)
    )
  }, [rows, q])

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => String(r.id),
    state: { pagination },
    onPaginationChange: setPagination,
  })

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Receipts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag &amp; drop or browse. Files upload directly to S3 via presigned URLs.
          </p>
        </CardHeader>
        <CardContent>
          <FilePond
            allowMultiple
            maxFiles={10}
            maxFileSize="6MB"
            acceptedFileTypes={[
              "image/*", "application/pdf",
            ]}
            credits={false}
            labelIdle='Drag your files here or <span class="filepond--label-action">browse</span>'
            server={{
              process: async (
                _fieldName,
                file,
                _metadata,
                load: (id: string) => void,
                error: (msg: string) => void,
                progress: (computable: boolean, loaded: number, total: number) => void,
                abort,
              ) => {
                const controller = new AbortController()
                try {
                  const presign = await api.post("/receipts/presign", {
                    filename: file.name, content_type: file.type, user_sub: userSub,
                  })
                  const xhr = new XMLHttpRequest()
                  xhr.open("PUT", presign.data.upload_url)
                  xhr.setRequestHeader("Content-Type", file.type)
                  xhr.upload.onprogress = (e) => progress(e.lengthComputable, e.loaded, e.total)
                  xhr.onload = async () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                      const created = await api.post("/receipts", {
                        receipt: {
                          filename: file.name,
                          s3_key: presign.data.key,
                          url: presign.data.public_url,
                          content_type: file.type,
                          size: file.size,
                          user_sub: userSub,
                          folder: presign.data.folder,
                          bucket: presign.data.bucket,
                          etag: xhr.getResponseHeader("ETag")?.replace(/"/g, ""),
                          metadata: {
                            uploaded_at: new Date().toISOString(),
                            content_type: file.type,
                            size: file.size,
                          },
                        },
                      })
                      load(String(created.data.id))
                      toast.success(`Uploaded ${file.name}`)
                      setTimeout(() => load === undefined ? null : null, 0)
                      // refresh list
                      void refresh()
                    } else {
                      const msg = `Upload failed (${xhr.status})`
                      error(msg)
                      toast.error(msg)
                    }
                  }
                  xhr.onerror = () => {
                    error("Network error")
                    toast.error(`Upload failed: network error`)
                  }
                  xhr.send(file)
                  return {
                    abort: () => { controller.abort(); xhr.abort(); abort() },
                  }
                } catch (e: any) {
                  const msg = e?.response?.data?.error || "S3 not configured — set AWS_* in backend/.env"
                  error(msg)
                  toast.error(msg)
                }
              },
              revert: null,
            }}
          />
        </CardContent>
      </Card>

      <DataGrid
        table={table}
        recordCount={filteredRows.length}
        isLoading={loading && rows.length === 0}
        loadingMode="skeleton"
        emptyMessage="No receipts uploaded yet"
        tableLayout={{
          columnsPinnable: true,
          columnsResizable: false,
          columnsMovable: true,
          columnsVisibility: true,
        }}
      >
        <Frame className="w-full flex-1 min-h-0 flex flex-col" stacked dense>
          <FrameHeader className="flex w-full flex-row flex-wrap items-center justify-between gap-3">
            <FrameTitle>Receipts</FrameTitle>
            <div className="flex items-center gap-2.5">
              <InputGroup className="w-96">
                <InputGroupAddon align="inline-start"><SearchIcon /></InputGroupAddon>
                <InputGroupInput
                  placeholder="Search..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q.length > 0 && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton aria-label="Clear search" size="icon-xs" onClick={() => setQ("")}>
                      <XIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </div>
          </FrameHeader>
          <FramePanel ref={panelRef} className="flex-1 min-h-0 overflow-hidden p-0 shadow-none">
            <DataGridScrollArea className="h-full">
              <DataGridTable />
            </DataGridScrollArea>
          </FramePanel>
          <FrameFooter className="py-1.5 pr-2 pl-2.5">
            <DataGridPagination />
          </FrameFooter>
        </Frame>
      </DataGrid>
    </div>
  )

  function refresh() { load() }
}

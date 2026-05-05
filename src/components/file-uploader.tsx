"use client"

import { FilePond, registerPlugin } from "react-filepond"
import FilePondPluginFileValidateSize from "filepond-plugin-file-validate-size"
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type"
import "filepond/dist/filepond.min.css"
import "@/styles/filepond.css"
import { useRef } from "react"
import { api } from "@/lib/api"

registerPlugin(FilePondPluginFileValidateSize, FilePondPluginFileValidateType)

export type UploadedFile = {
  filename: string
  content_type: string
  byte_size: number
  storage_key: string
  public_url: string
}

interface FileUploaderProps {
  /** Sub-folder under the bucket; presign endpoint scopes the key under it. */
  userSub?: string
  acceptedFileTypes?: string[]
  /** Bytes — defaults to 10 MB. */
  maxFileSize?: string
  allowMultiple?: boolean
  onUploaded?: (file: UploadedFile) => void | Promise<void>
}

export function FileUploader({
  userSub = "anonymous",
  acceptedFileTypes = ["image/*", "application/pdf"],
  maxFileSize = "10MB",
  allowMultiple = true,
  onUploaded,
}: FileUploaderProps) {
  const pondRef = useRef<FilePond | null>(null)

  return (
    <FilePond
      ref={(r) => {
        pondRef.current = r
      }}
      allowMultiple={allowMultiple}
      acceptedFileTypes={acceptedFileTypes}
      maxFileSize={maxFileSize}
      labelIdle='Drag &amp; drop receipts here, or <span class="filepond--label-action">browse</span>'
      credits={false}
      server={{
        // Custom uploader: presign → PUT to Backblaze → resolve.
        process: ((
          _fieldName: string,
          file: File,
          _metadata: any,
          load: (key: string) => void,
          error: (msg: string) => void,
          progress: (
            computable: boolean,
            loaded: number,
            total: number,
          ) => void,
          abort: () => void,
        ) => {
          let aborted = false
          const xhr = new XMLHttpRequest()

          ;(async () => {
            try {
              const presign = await api.post<{
                upload_url: string
                key: string
                public_url: string
              }>("/api/receipts/presign", {
                filename: file.name,
                content_type: file.type,
                user_sub: userSub,
              })

              xhr.open("PUT", presign.upload_url, true)
              xhr.setRequestHeader(
                "Content-Type",
                file.type || "application/octet-stream",
              )
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) progress(true, e.loaded, e.total)
              }
              xhr.onload = async () => {
                if (aborted) return
                if (xhr.status >= 200 && xhr.status < 300) {
                  load(presign.key)
                  if (onUploaded) {
                    await onUploaded({
                      filename: file.name,
                      content_type: file.type,
                      byte_size: file.size,
                      storage_key: presign.key,
                      public_url: presign.public_url,
                    })
                  }
                } else {
                  error(`Upload failed: HTTP ${xhr.status}`)
                }
              }
              xhr.onerror = () => error("Network error during upload")
              xhr.send(file)
            } catch (e: any) {
              error(e?.message ?? "Presign failed")
            }
          })()

          return {
            abort: () => {
              aborted = true
              xhr.abort()
              abort()
            },
          }
        }) as any,
        // No revert / restore — uploads are immutable once committed.
        revert: null,
      }}
    />
  )
}

import { FILES_MANAGEMENT_BASE, managementClient } from "@/api/managementClients"

/** ⚠️ The LIBRARY's base path, not Tessera's `/api` — see `@/api/managementClients`. */
const httpClient = managementClient(FILES_MANAGEMENT_BASE)

/**
 * The files hanging off an issue.
 *
 * ⚠️ **These routes are the shared library's, not Tessera's** (`TSSR-49`). `jmouse-storage-management`
 * serves `/api/files`, and Tessera adds only what no library could know: what an attachment is filed
 * against, who may read it, and what it means in the issue's history. So there is nothing here to
 * mirror a backend DTO of ours against — the shape below is `FileView`'s.
 */
export interface Attachment {
  id: string
  name: string
  contentType: string
  sizeBytes: number
  /** Who put it there, as a member id — the server decides this, never the client. */
  uploadedBy: string | null
  createdAt: string
}

/**
 * What an attachment is filed against.
 *
 * ⚠️ **`ISSUE:<id>`, and the id — never the KEY.** `ProjectRekeyService` rewrites issue keys, so a
 * binding written against `TSSR-42` would silently orphan every attachment the day somebody re-keys a
 * project. The identifier is the issue; the key is a rendering of where it was raised.
 */
export function issueOwner(issueId: string) {
  return `ISSUE:${issueId}`
}

/** Everything attached to one issue. */
export function listAttachments(issueId: string) {
  return httpClient
    .get<Attachment[]>("/files", { params: { owner: issueOwner(issueId) } })
    .then((response) => response.data)
}

/**
 * Attach a file.
 *
 * ⚠️ The multipart boundary is the browser's to set — naming a `Content-Type` here produces a request
 * with no boundary in it, which the server cannot parse and which fails as a bad request rather than as
 * anything mentioning headers.
 */
export function uploadAttachment(issueId: string, file: File, onProgress?: (percent: number) => void) {
  const body = new FormData()

  body.append("file", file)

  return httpClient
    .post<Attachment>("/files", body, {
      params: { owner: issueOwner(issueId) },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    })
    .then((response) => response.data)
}

/**
 * ⚠️ **There is deliberately no `contentUrl` helper here.**
 *
 * The obvious one — `/api/files/{id}/content` — is a URL nothing in this interface may put in an
 * `<img src>`, an `<a href>` or a download attribute, because Tessera authenticates with a header and a
 * browser sends none for any of those: every one answers `401`, which renders as *the file is missing*.
 *
 * Offering the helper would be offering the mistake. The bytes come through `attachmentBytes.ts`, fetched
 * with the reader's own credentials — see the note there for why that is right rather than a public
 * token route.
 */

/** Remove it from the issue. The bytes stay until the sweeper finds nothing pointing at them. */
export function deleteAttachment(attachmentId: string) {
  return httpClient.delete(`/files/${attachmentId}`).then(() => undefined)
}

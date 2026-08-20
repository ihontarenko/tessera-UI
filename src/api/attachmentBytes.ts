import { useEffect, useState } from "react"
import { httpClient } from "@/api/httpClient"

/**
 * The bytes of an attachment, fetched with the reader's own credentials.
 *
 * <h2>⚠️ Why this exists at all — an `<img src>` cannot sign in</h2>
 *
 * <p>Tessera authenticates with a bearer token in a header. A browser fetching `<img src="/api/…">`,
 * following an `<a href>` or starting a download sends **no header at all**, so every one of those
 * answers `401` — a broken thumbnail, a blank tab, a failed save. It looks like the file is missing.</p>
 *
 * <p>The alternative would be a public byte route addressed by an unguessable token, the way avatars and
 * Innoventa's share links work. ⚠️ **Deliberately not that.** A token route is a *second* answer to "who
 * may read this file", living beside the one the access engine already gives — and the two would drift
 * the first time somebody changed who may browse a project. Fetching with the reader's token keeps one
 * answer: the same engine decides, per reader, on every request.</p>
 *
 * <p>⚠️ The object URL is revoked when the component goes away. Without that, scrolling a list of issues
 * leaks every image it ever rendered, and the leak is invisible until a long session gets heavy.</p>
 */
export function useAttachmentBytes(attachmentId: string, enabled: boolean) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let revoked = false
    let created: string | null = null

    fetchAttachmentBytes(attachmentId)
      .then((blob) => {
        if (revoked) {
          return
        }

        created = URL.createObjectURL(blob)
        setObjectUrl(created)
      })
      // A thumbnail that cannot be fetched simply does not appear — the row still says what the file is,
      // and a toast per unreachable image in a list would be a wall of noise about one failure.
      .catch(() => undefined)

    return () => {
      revoked = true

      if (created) {
        URL.revokeObjectURL(created)
      }
    }
  }, [attachmentId, enabled])

  return objectUrl
}

/** The bytes themselves, for a download or a new tab. */
export function fetchAttachmentBytes(attachmentId: string) {
  return httpClient
    .get<Blob>(`/files/${attachmentId}/content`, { responseType: "blob" })
    .then((response) => response.data)
}

/**
 * Hand the file to the browser as a download.
 *
 * ⚠️ The object URL is revoked on the next tick rather than immediately: revoking it in the same turn as
 * the click cancels the download in some browsers, because the save has not started yet.
 */
export async function downloadAttachment(attachmentId: string, filename: string) {
  const blob = await fetchAttachmentBytes(attachmentId)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  setTimeout(() => URL.revokeObjectURL(url), 0)
}

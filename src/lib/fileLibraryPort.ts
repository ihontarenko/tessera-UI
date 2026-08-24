import type { Directory, FileLibraryPort, ManagedFile } from "@jmouse/files"
import { FILES_MANAGEMENT_BASE, managementClient } from "@/api/managementClients"

/** ⚠️ The LIBRARY's base path, not Tessera's `/api` — see `@/api/managementClients`. */
const filesClient = managementClient(FILES_MANAGEMENT_BASE)

/** The installation's own tree — the library's sentinel owner, a bare asterisk and not a `KIND:id`. */
export const INSTALLATION_OWNER = "*"

/** One member's own tree. Matches `FileTrees.OWNER_MEMBER` on the backend. */
export function memberOwner(memberId: string) {
  return `MEMBER:${memberId}`
}

/** A folder, as an owner — what `?owner=` carries when a call is about what is filed in one. */
export function directoryOwner(directoryId: string) {
  return `DIRECTORY:${directoryId}`
}

/**
 * Tessera's half of `@jmouse/files` — how the shared manager reaches this product (`TSSR-0106`).
 *
 * ⚠️ **The package deliberately fetches nothing.** Three products authenticate differently and one of
 * them is called cross-origin by two others, so an HTTP client baked into a shared component would have
 * decided that for all of them. What arrives instead is this: the product's own client, over the
 * library's own routes.
 *
 * ⚠️ **All three presentation seams answer nothing, and that is the honest answer here.**
 *
 * - `thumbnailUrl` — absent. Every file route in this product is authenticated and Tessera mints no
 *   per-file public token, so there is no address an `<img>` could load. The manager draws the type's
 *   glyph instead of a broken frame, and a preview still arrives through `bytes()`.
 * - `openUrl`, `shareUrl` — absent, for the same reason: a Copy button yielding an address that answers
 *   401 to whoever it is sent to is a promise this product cannot keep.
 * - `importFrom` — absent. `jmouse.files.management.import.enabled` is off, so the manager offers no
 *   field to type an address into rather than one that always fails.
 */
export function tesseraFileLibrary(): FileLibraryPort {
  return {
    subtree: (directoryId) =>
      filesClient
        .get<Directory[]>(`/directories/${directoryId}/subtree`)
        .then((response) => response.data),

    filesIn: (directoryId) =>
      filesClient
        .get<ManagedFile[]>("/files", { params: { owner: directoryOwner(directoryId) } })
        .then((response) => response.data),

    // ⚠️ Through the product's own client, never an `<img src>` or an `<iframe src>`: this route is
    // authenticated, a browser-issued request for it carries no credentials, and the 401 draws as a
    // file that is missing rather than as one that was refused.
    bytes: (file) =>
      filesClient
        .get<Blob>(`/files/${file.id}/content`, { responseType: "blob" })
        .then((response) => response.data),

    upload: (directoryId, file, onProgress) => {
      const body = new FormData()

      body.append("file", file)

      // ⚠️ No `Content-Type` header: the browser writes the multipart boundary into it, and naming the
      // type here produces a body the server cannot parse — which fails as a bad request mentioning
      // nothing about headers.
      return filesClient
        .post<ManagedFile>("/files", body, {
          params: { owner: directoryOwner(directoryId) },
          onUploadProgress: (event) => {
            if (onProgress && event.total) {
              onProgress(Math.round((event.loaded * 100) / event.total))
            }
          },
        })
        .then((response) => response.data)
    },

    createDirectory: (parentId, name) =>
      filesClient
        .post<Directory>("/directories", { name }, { params: { parentId } })
        .then((response) => response.data),

    renameDirectory: (directoryId, name) =>
      filesClient
        .put<Directory>(`/directories/${directoryId}`, { name })
        .then((response) => response.data),

    // ⚠️ Never with the subtree. The backend refuses a folder that still holds something, and being
    // refused is the right answer — a one-click delete that takes a branch with it is a click nobody
    // meant to make.
    deleteDirectory: (directoryId) =>
      filesClient.delete<void>(`/directories/${directoryId}`).then(() => undefined),

    renameFile: (fileId, name) =>
      filesClient.put<ManagedFile>(`/files/${fileId}`, { name }).then((response) => response.data),

    refileFile: (fileId, directoryId) =>
      filesClient
        .put<ManagedFile>(`/files/${fileId}/binding`, { owner: directoryOwner(directoryId) })
        .then((response) => response.data),

    deleteFile: (fileId) => filesClient.delete<void>(`/files/${fileId}`).then(() => undefined),
  }
}

/**
 * The roots one owner has.
 *
 * ⚠️ **Asked per owner, because a root belongs to one.** `storage_directories` is keyed
 * `(owner_key, path)`, and Tessera runs two trees over that: the installation's `tessera/attachments`,
 * and a `tessera/library` per member. They are two calls rather than one because the library's route
 * takes a single owner — which is also what makes it authorizable at all (`JMF-48`): an unqualified
 * roots route would let anybody list anybody's tree by naming them in a query parameter.
 */
export function fetchRoots(owner: string) {
  return filesClient
    .get<Directory[]>("/directories", { params: { owner } })
    .then((response) => response.data)
}

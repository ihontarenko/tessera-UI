import { httpClient } from "@/api/httpClient"

export type SystemRole = "ADMIN" | "USER"

export type AvatarKind = "INITIALS" | "PRESET" | "UPLOAD"

/**
 * A person's face, as the server decided it should be drawn.
 *
 * Exactly one of `preset`/`url` carries a value and the other is `null` — never `undefined`, because
 * Tessera does not omit nulls from responses. Which one it is follows from `kind`, so nothing here has
 * to be probed.
 */
export interface MemberAvatarView {
  kind: AvatarKind
  /** The seed a generated pixel face is drawn from — non-null only when `kind` is `PRESET`. */
  preset: string | null
  /** Where an uploaded picture's bytes are — non-null only when `kind` is `UPLOAD`. */
  url: string | null
}

export interface CurrentMember {
  id: string
  subject: string
  displayName: string | null
  email: string | null
  avatar: MemberAvatarView
  systemRole: SystemRole
  /**
   * What this member holds **installation-wide** — not in any project.
   *
   * ⚠️ This is what lets the shell decide whether to render Administration before anything is clicked.
   * Never the authority: every route it leads to is gated server-side and refuses independently. Project
   * permissions are a different question with a different answer per project, and travel on
   * `ProjectResponse.myPermissions`.
   */
  globalPermissions: string[]
}

export interface MemberSummary {
  id: string
  displayName: string | null
  email: string | null
  avatar: MemberAvatarView
}

export function fetchCurrentMember() {
  return httpClient.get<CurrentMember>("/members/me").then((response) => response.data)
}

export function searchMembers(query?: string) {
  return httpClient
    .get<MemberSummary[]>("/members", { params: query ? { query } : undefined })
    .then((response) => response.data)
}

/**
 * Wear a generated pixel face.
 *
 * The seed is whatever the picker offered — the server keeps no catalogue of faces and checks only
 * that the value looks like a seed, so extending `PRESET_SEEDS` needs no backend change.
 */
export function chooseAvatarPreset(preset: string) {
  return httpClient
    .put<MemberAvatarView>("/members/me/avatar", { preset })
    .then((response) => response.data)
}

/**
 * Wear an uploaded picture.
 *
 * ⚠️ `file` is expected to be already square and downscaled — see `squareToPng` in
 * `@/lib/squareImage`. The server's size ceiling is a megabyte, which a phone photograph clears by an
 * order of magnitude, so skipping that step means a refusal rather than a slow upload.
 *
 * No explicit `Content-Type`: the browser must set the multipart boundary itself, and naming the type
 * here overwrites it with one that has none.
 */
export function uploadAvatarPicture(file: Blob) {
  const body = new FormData()
  body.append("file", file, "avatar.png")

  return httpClient
    .post<MemberAvatarView>("/members/me/avatar", body)
    .then((response) => response.data)
}

/** Drop back to drawn initials. */
export function clearAvatar() {
  return httpClient.delete<MemberAvatarView>("/members/me/avatar").then((response) => response.data)
}

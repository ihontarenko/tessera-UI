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
  /**
   * Whether this is a person or a client (TSSR-34, TSSR-36).
   *
   * ⚠️ **This replaced `agentName` on two payloads**, and it is why the single `MemberSummary` funnel
   * was worth having. Provenance used to be a bare string carried beside the author, rendered as a badge
   * glued next to somebody else's chip. Now the author *is* the agent — so a client arrives with a name,
   * a face and this, and every payload embedding a member got it at once.
   *
   * ⚠️ **An offer to the interface, never a claim about authority.** An agent carries none; what a
   * client may do is what the person who approved it may do.
   */
  kind: "PERSON" | "AGENT"
  /** Whose client it is, and null on a person. ⚠️ For rendering "SU's client" — nothing else. */
  parentId: string | null
  /** Whether the client has been switched off. Everything it wrote keeps its name. */
  retired: boolean
}

/** Whether a member reference is a client rather than a person. */
export function isAgent(member: MemberSummary | null | undefined): boolean {
  return member?.kind === "AGENT"
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
 * ⚠️ `file` is expected to be already square and downscaled — it comes out of `@jmouse/ui`'s
 * `ImageCropper` on `AVATAR_CROP`. The server's size ceiling is a megabyte, which a phone photograph
 * clears by an order of magnitude, so skipping that step means a refusal rather than a slow upload.
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

/** Which kind of member a row is — the axis the administration list's segmented control filters on. */
export type MemberKind = MemberSummary["kind"]

/**
 * The administration list — people, clients, or both (TSSR-79).
 *
 * ⚠️ **A different route from {@link searchMembers}, not a parameter on it.** That one is the picker
 * somebody adds a colleague to a project from: it stays open to every signed-in caller and stays
 * people-only, because offering a client where one cannot be chosen would be offering a refusal. This
 * one is behind `member:administer`.
 */
export function fetchAdministeredMembers(query?: string, kind?: MemberKind) {
  return httpClient
    .get<MemberSummary[]>("/members/administered", { params: { query, kind } })
    .then((response) => response.data)
}

/**
 * Renames a member — a person, or somebody else's client (TSSR-80).
 *
 * ⚠️ For a client the server sends this through the agent directory so the member mirror **follows**,
 * which is what makes every by-line it has ever left read the new name.
 */
export function renameMember(memberId: string, displayName: string) {
  return httpClient
    .patch<MemberSummary>(`/members/${memberId}`, { displayName })
    .then((response) => response.data)
}

/**
 * A generated face for somebody else's account (TSSR-80).
 *
 * ⚠️ **Not `/members/me/avatar` with an identifier.** That route takes the signed-in member and
 * structurally cannot name another; these two name one and are behind `member:administer`.
 */
export function chooseAvatarPresetFor(memberId: string, preset: string) {
  return httpClient
    .put<MemberAvatarView>(`/members/${memberId}/avatar`, { preset })
    .then((response) => response.data)
}

/** ⚠️ `file` is expected to be already square and downscaled — see {@link uploadAvatarPicture}. */
export function uploadAvatarPictureFor(memberId: string, file: Blob) {
  const body = new FormData()

  body.append("file", file, "avatar.png")

  return httpClient
    .post<MemberAvatarView>(`/members/${memberId}/avatar`, body)
    .then((response) => response.data)
}

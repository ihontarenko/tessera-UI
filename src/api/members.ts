import { httpClient } from "@/api/httpClient"

export type SystemRole = "ADMIN" | "USER"

export interface CurrentMember {
  id: string
  subject: string
  displayName: string | null
  email: string | null
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
}

export function fetchCurrentMember() {
  return httpClient.get<CurrentMember>("/members/me").then((response) => response.data)
}

export function searchMembers(query?: string) {
  return httpClient
    .get<MemberSummary[]>("/members", { params: query ? { query } : undefined })
    .then((response) => response.data)
}

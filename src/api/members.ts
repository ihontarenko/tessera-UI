import { httpClient } from "@/api/httpClient"

export type SystemRole = "ADMIN" | "USER"

export interface CurrentMember {
  id: string
  subject: string
  displayName: string | null
  email: string | null
  systemRole: SystemRole
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

import { httpClient } from "@/api/httpClient"
import type { IssueRow } from "@/api/issues"

/**
 * What a project has delivered (TSSR-4), grouped by the time it was delivered in.
 *
 * `groupedBySprint` comes from the server rather than being re-derived from the board's scope strategy
 * here: the two would agree today and drift the first time either changes, and a screen labelling a
 * month as a sprint is a bug nobody would think to look for.
 */
export interface ShippedGroup {
  /** What the group is ordered by — a sprint id, or `2026-08`. Never shown. */
  key: string
  /** What a reader sees — a sprint's name, or `August 2026`. */
  title: string
  issues: IssueRow[]
  issueCount: number
  storyPoints: number | null
}

export interface ShippedResponse {
  projectId: string
  groupedBySprint: boolean
  groups: ShippedGroup[]
  archivedIssues: number
}

export function getShipped(projectId: string) {
  return httpClient.get<ShippedResponse>(`/projects/${projectId}/shipped`).then((response) => response.data)
}

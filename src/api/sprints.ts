import { httpClient } from "@/api/httpClient"
import type { MemberSummary } from "@/api/members"
import type { IssueTypeSummary, PrioritySummary } from "@/api/issues"

// ── Sprint payloads (mirror the backend dto/sprint.* and dto/backlog.* records) ──────────────────

export type SprintState = "FUTURE" | "ACTIVE" | "CLOSED"

/** Which issues a board draws from — and the whole of "this project plans in sprints" (ADR-0012). */
export type BoardScopeStrategy = "ALL_ISSUES" | "ACTIVE_SPRINT"

export interface SprintSummary {
  id: string
  projectId: string
  name: string
  goal: string | null
  state: SprintState
  /** Stamped server-side at start; null while the sprint is only planned. */
  startedAt: string | null
  endDate: string | null
  completedAt: string | null
}

/** The running sprint's context, as the board header renders it. `daysRemaining` is signed — negative
 *  means the sprint is past its end date, which the header shows rather than hides. */
export interface ActiveSprintView {
  id: string
  name: string
  goal: string | null
  endDate: string | null
  daysRemaining: number | null
}

/** One backlog row — a planning unit (ADR-0014), so never a sub-task or an epic. */
export interface BacklogIssue {
  id: string
  issueKey: string
  summary: string
  type: IssueTypeSummary | null
  priority: PrioritySummary | null
  assignee: MemberSummary | null
  storyPoints: number | null
  open: boolean
  rank: string
}

/** A sprint's panel, or the product backlog itself (`sprint` null). Counts and totals come from the
 *  server, so the client never has to agree with it about arithmetic. */
export interface BacklogPanel {
  sprint: SprintSummary | null
  issues: BacklogIssue[]
  issueCount: number
  storyPointTotal: number
}

export interface BacklogResponse {
  projectId: string
  scopeStrategy: BoardScopeStrategy
  /** Absent when no sprint is running — the server omits nulls. */
  activeSprint: BacklogPanel | null
  futureSprints: BacklogPanel[]
  backlog: BacklogPanel
}

/** Every drag on the screen: `targetSprintId` null means the product backlog. */
export interface BacklogMoveRequest {
  issueKey: string
  targetSprintId: string | null
  beforeIssueKey?: string | null
  afterIssueKey?: string | null
}

// ── The backlog screen ────────────────────────────────────────────────────────────────────────────

export function getBacklog(projectId: string) {
  return httpClient.get<BacklogResponse>(`/projects/${projectId}/backlog`).then((response) => response.data)
}

/** Membership and rank change in one transaction, and the whole screen comes back — a move changes two
 *  panels' counts and totals. */
export function moveBacklogIssue(projectId: string, request: BacklogMoveRequest) {
  return httpClient
    .post<BacklogResponse>(`/projects/${projectId}/backlog/move`, request)
    .then((response) => response.data)
}

// ── Sprint lifecycle (all mutations require MANAGE_SPRINT) ───────────────────────────────────────

export interface SaveSprintRequest {
  name: string
  goal?: string | null
}

export function listSprints(projectId: string) {
  return httpClient.get<SprintSummary[]>(`/projects/${projectId}/sprints`).then((response) => response.data)
}

export function createSprint(projectId: string, request: SaveSprintRequest) {
  return httpClient.post<SprintSummary>(`/projects/${projectId}/sprints`, request).then((response) => response.data)
}

export function updateSprint(projectId: string, sprintId: string, request: SaveSprintRequest) {
  return httpClient
    .put<SprintSummary>(`/projects/${projectId}/sprints/${sprintId}`, request)
    .then((response) => response.data)
}

/** Permitted for a FUTURE sprint only; its issues return to the backlog rather than being deleted. */
export function deleteSprint(projectId: string, sprintId: string) {
  return httpClient.delete<void>(`/projects/${projectId}/sprints/${sprintId}`).then((response) => response.data)
}

/** The end date is required — without it the burndown has no axis, and the server refuses with a 409. */
export function startSprint(projectId: string, sprintId: string, endDate: string) {
  return httpClient
    .post<SprintSummary>(`/projects/${projectId}/sprints/${sprintId}/start`, { endDate })
    .then((response) => response.data)
}

export const MANAGE_SPRINT = "MANAGE_SPRINT"

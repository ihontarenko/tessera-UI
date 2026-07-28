import { httpClient } from "@/api/httpClient"
import type { MemberSummary } from "@/api/members"
import type { IssueTypeSummary, PrioritySummary, StatusCategory, StatusSummary } from "@/api/issues"

// ── Board payload (mirrors the backend dto/board.* records) ──────────────────────────────────────

export type SwimlaneStrategy = "NONE" | "ASSIGNEE" | "EPIC" | "PRIORITY"

export interface BoardColumnView {
  id: string
  name: string
  position: number
  minIssues: number | null
  maxIssues: number | null
  fallbackForCategory: StatusCategory | null
  explicitStatusIds: string[]
}

/** One card — an issue projected for the board, already resolved to its `columnId` server-side. */
export interface BoardCard {
  id: string
  issueKey: string
  summary: string
  type: IssueTypeSummary | null
  priority: PrioritySummary | null
  status: StatusSummary | null
  assignee: MemberSummary | null
  open: boolean
  columnId: string | null
  rank: string
  // Raw grouping keys the client uses for swimlanes / quick-filters (later Phase-2 tickets).
  assigneeId: string | null
  priorityId: string | null
}

export interface BoardResponse {
  boardId: string
  projectId: string
  name: string
  swimlaneStrategy: SwimlaneStrategy
  hideDoneOlderThanDays: number | null
  columns: BoardColumnView[]
  cards: BoardCard[]
}

// Addressed by the same {projectId} the rest of the project API uses — the board is 1:1 with a project.
export function getBoard(projectId: string) {
  return httpClient.get<BoardResponse>(`/projects/${projectId}/board`).then((response) => response.data)
}

// ── Move (Phase-2 ticket 02) ───────────────────────────────────────────────────────────────────────

export interface BoardMoveRequest {
  issueKey: string
  targetColumnId: string
  beforeIssueKey?: string | null
  afterIssueKey?: string | null
  resolutionId?: string | null
}

export function moveCard(projectId: string, request: BoardMoveRequest) {
  return httpClient.post<BoardCard>(`/projects/${projectId}/board/move`, request).then((response) => response.data)
}

// ── Column configuration (Phase-2 ticket 03, ADMINISTER_PROJECT) ──────────────────────────────────

export interface CreateBoardColumnRequest {
  name: string
  position?: number | null
  minIssues?: number | null
  maxIssues?: number | null
}

export interface UpdateBoardColumnRequest {
  name: string
  minIssues?: number | null
  maxIssues?: number | null
}

export function createColumn(projectId: string, request: CreateBoardColumnRequest) {
  return httpClient
    .post<BoardColumnView>(`/projects/${projectId}/board/columns`, request)
    .then((response) => response.data)
}

export function updateColumn(projectId: string, columnId: string, request: UpdateBoardColumnRequest) {
  return httpClient
    .put<BoardColumnView>(`/projects/${projectId}/board/columns/${columnId}`, request)
    .then((response) => response.data)
}

export function reorderColumn(projectId: string, columnId: string, position: number) {
  return httpClient
    .put<BoardColumnView>(`/projects/${projectId}/board/columns/${columnId}/position`, { position })
    .then((response) => response.data)
}

export function deleteColumn(projectId: string, columnId: string) {
  return httpClient.delete<void>(`/projects/${projectId}/board/columns/${columnId}`).then((response) => response.data)
}

export function setColumnFallback(projectId: string, columnId: string, category: StatusCategory) {
  return httpClient
    .put<BoardColumnView>(`/projects/${projectId}/board/columns/${columnId}/fallback`, { category })
    .then((response) => response.data)
}

export function clearColumnFallback(projectId: string, columnId: string) {
  return httpClient
    .delete<void>(`/projects/${projectId}/board/columns/${columnId}/fallback`)
    .then((response) => response.data)
}

export function mapColumnStatus(projectId: string, columnId: string, statusId: string) {
  return httpClient
    .put<void>(`/projects/${projectId}/board/columns/${columnId}/statuses/${statusId}`)
    .then((response) => response.data)
}

export function unmapColumnStatus(projectId: string, columnId: string, statusId: string) {
  return httpClient
    .delete<void>(`/projects/${projectId}/board/columns/${columnId}/statuses/${statusId}`)
    .then((response) => response.data)
}

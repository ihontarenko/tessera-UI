import { httpClient } from "@/api/httpClient"
import type { MemberSummary } from "@/api/members"
import type { IssueSchedule, IssueTypeSummary, PrioritySummary, StatusCategory, StatusSummary } from "@/api/issues"
import type { ActiveSprintView, BoardScopeStrategy } from "@/api/sprints"

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
  // Raw grouping keys the client uses for swimlanes (ticket 04) and quick filters (ticket 05).
  assigneeId: string | null
  priorityId: string | null
  /** Nearest Epic ancestor's key, resolved server-side; `null` gathers the card in the "No epic" lane. */
  epicKey: string | null
  /**
   * Something unresolved is holding this card up (TSSR-41).
   *
   * ⚠️ A flag, not the keys — a board is where somebody decides what to pick up, and that decision
   * needs "not this one", not a list to read. The keys are one click away on the issue.
   */
  blocked: boolean
  /**
   * When it is meant to happen, and how pressing that is today. Never null.
   *
   * ⚠️ On a card, unlike `blocked`, and for the opposite reason. A blocker is a list of other issues and
   * costs a query per card, so the card carries a flag. A schedule is three columns already loaded with
   * the row — and the board is the screen where "what is due" decides what somebody drags next.
   */
  schedule: IssueSchedule
  /** Recorded completion time the done-threshold measures against (ticket 06) — never `updatedAt`. */
  resolvedAt: string | null
}

export interface BoardResponse {
  boardId: string
  projectId: string
  name: string
  swimlaneStrategy: SwimlaneStrategy
  /** Where `cards` came from: the whole project, or only the active sprint (ADR-0012). */
  scopeStrategy: BoardScopeStrategy
  hideDoneOlderThanDays: number | null
  /** The running sprint's context for the header — absent under `ALL_ISSUES`, or when none is running. */
  activeSprint: ActiveSprintView | null
  columns: BoardColumnView[]
  cards: BoardCard[]
  /**
   * Which cards satisfied the request's `filter` predicate (ADR-0008), or `null` when it carried none.
   *
   * The filtered-out cards are still sent, and marked rather than dropped, because a filter narrows
   * what one viewer is looking at and not what the board holds — WIP counts have to stay taken over
   * everything on the board.
   */
  matchedCardIds: string[] | null
}

/**
 * Addressed by the same {projectId} the rest of the project API uses — the board is 1:1 with a project.
 *
 * `filter` is a jME predicate over one issue (ADR-0008). Only the expression travels: the server
 * already holds the issues, so filtering costs one query parameter instead of a round trip of the
 * board's own payload — and it keeps working when a filter has to outgrow the loaded slice.
 */
export function getBoard(projectId: string, filter: string | null = null) {
  return httpClient
    .get<BoardResponse>(`/projects/${projectId}/board`, filter === null ? undefined : { params: { filter } })
    .then((response) => response.data)
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

// ── Board view settings (Phase-2 tickets 04/06, Phase-3 ticket 08, ADMINISTER_PROJECT) ────────────

export interface BoardSettingsView {
  swimlaneStrategy: SwimlaneStrategy
  scopeStrategy: BoardScopeStrategy
  hideDoneOlderThanDays: number | null
}

// Set independently, each through its own endpoint, never as one payload — a caller echoing back the
// setting it isn't changing would revert a concurrent edit from its own stale copy of the board.

export function setSwimlaneStrategy(projectId: string, strategy: SwimlaneStrategy) {
  return httpClient
    .put<BoardSettingsView>(`/projects/${projectId}/board/settings/swimlane-strategy`, { strategy })
    .then((response) => response.data)
}

/** `null` days keeps completed issues on the board forever. */
export function setDoneThreshold(projectId: string, days: number | null) {
  return httpClient
    .put<BoardSettingsView>(`/projects/${projectId}/board/settings/done-threshold`, { days })
    .then((response) => response.data)
}

/**
 * Switch the project between Scrum and a board of everything (ticket 08). It changes only what the
 * board renders: no sprint is started, closed or altered by it, so switching away while a sprint is
 * running and switching back shows that sprint exactly as it was.
 */
export function setScopeStrategy(projectId: string, strategy: BoardScopeStrategy) {
  return httpClient
    .put<BoardSettingsView>(`/projects/${projectId}/board/settings/scope-strategy`, { strategy })
    .then((response) => response.data)
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

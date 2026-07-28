import { httpClient } from "@/api/httpClient"
import type { MemberSummary } from "@/api/members"
import type { IssueTypeSummary, StatusSummary } from "@/api/issues"
import type { SprintSummary } from "@/api/sprints"

// ── Sprint report payload (mirrors the backend dto/report.* records) ──────────────────────────────

/** One day of the burndown, measured at the end of that day. */
export interface BurndownPoint {
  /** ISO date, `yyyy-MM-dd`. */
  date: string
  /**
   * Unfinished work still committed at the end of the day, or `null` for a day the sprint never
   * reached — beyond an early close, or still in the future. Null breaks the line rather than
   * repeating the last value, which would read as a team that stalled.
   */
  remaining: number | null
  /** The straight reference line from the committed total to zero on the end date. */
  ideal: number
  /** Everything committed that day, finished or not — the line that makes scope growth visible. */
  scope: number
}

/** One line of the report. `storyPoints` is the estimate frozen when the issue joined the sprint. */
export interface SprintReportIssue {
  id: string
  issueKey: string
  summary: string
  type: IssueTypeSummary | null
  status: StatusSummary | null
  assignee: MemberSummary | null
  storyPoints: number | null
}

/** The report and its burndown arrive together, because they are one load server-side (ADR-0013). */
export interface SprintReportResponse {
  sprint: SprintSummary
  committedIssues: number
  committedPoints: number
  completedIssues: number
  completedPoints: number
  completed: SprintReportIssue[]
  incomplete: SprintReportIssue[]
  removed: SprintReportIssue[]
  burndown: BurndownPoint[]
}

/** Readable for any sprint of the project that has run, closed or still running — never only the latest. */
export function getSprintReport(projectId: string, sprintId: string) {
  return httpClient
    .get<SprintReportResponse>(`/projects/${projectId}/sprints/${sprintId}/report`)
    .then((response) => response.data)
}

// ── Velocity (ticket 07) ─────────────────────────────────────────────────────────────────────────

/**
 * One closed sprint's bar pair. Both totals come from the same projection the sprint report uses, so a
 * sprint's headline and its bar here can never disagree.
 */
export interface VelocityPoint {
  sprintId: string
  sprintName: string
  committedIssues: number
  committedPoints: number
  completedIssues: number
  completedPoints: number
}

/**
 * The project's velocity across every sprint it has **closed**, oldest first. Running and future
 * sprints are excluded server-side — a partial sprint would drag the picture down for no reason — so a
 * project that has closed nothing yet gets an empty series rather than a misleading one.
 */
export function getVelocity(projectId: string) {
  return httpClient.get<VelocityPoint[]>(`/projects/${projectId}/velocity`).then((response) => response.data)
}

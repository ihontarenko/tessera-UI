import { httpClient } from "@/api/httpClient"

/**
 * The dashboard's aggregates — one read for every chart on the screen.
 *
 * ⚠️ **Every number is already confined to the projects the caller may browse.** That happens on the
 * server, before anything is counted, rather than as a filter over a total — see `DashboardService`.
 * Nothing here needs narrowing again in the browser, and nothing here can be widened by asking
 * differently.
 */
export type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE"

/**
 * How many issues **entered** one status inside the window.
 *
 * ⚠️ Moves, not issues: one issue bounced back into review twice is two. And `category` is null for a
 * status the catalogue no longer holds — the log stores names, so a renamed status keeps its history
 * under the old one.
 */
export interface StatusMovement {
  status: string
  category: StatusCategory | null
  count: number
}

/** One project's live issues in three buckets — the segments of its meter. Archived ones are excluded. */
export interface ProjectProgress {
  projectId: string
  todo: number
  inProgress: number
  done: number
}

/**
 * One day, from both sides.
 *
 * ⚠️ **Two series, one axis** — both are counts of issues, so they are directly comparable, which is the
 * whole point. "Twelve raised" is activity; "twelve raised and three resolved" is a backlog growing.
 * ⚠️ Days with nothing are present with zeros, never omitted.
 */
export interface FlowPoint {
  date: string
  created: number
  resolved: number
}

/**
 * One open issue and how long it has sat where it is.
 *
 * ⚠️ `days` is time in the CURRENT status, not the issue's age — a card raised in March and moved
 * yesterday is one day old here. That is the number a board structurally cannot show: a card looks
 * identical on its first day in a column and on its fortieth.
 */
export interface AgeingIssue {
  issueKey: string
  summary: string
  status: string
  category: StatusCategory | null
  days: number
}

/**
 * One issue that cannot start, and for how long.
 *
 * ⚠️ Blockers are **keys only** — a blocker may sit in a project the reader cannot open, so a summary
 * would be somebody else's backlog read out to a stranger. ⚠️ `days` runs from the earliest blocking
 * link, so adding a second blocker to already-stuck work does not restart the clock.
 */
export interface BlockedIssue {
  issueKey: string
  summary: string
  blockers: string[]
  days: number
}

export interface DashboardSummary {
  createdToday: number
  createdInWindow: number
  resolvedInWindow: number
  flowPerDay: FlowPoint[]
  movedInto: StatusMovement[]
  projects: ProjectProgress[]
  /** The longest-sitting open issues, oldest first — capped; `openTotal` says of how many. */
  ageing: AgeingIssue[]
  openTotal: number
  /** Longest-held first — capped the same way; `blockedTotal` says of how many. */
  blocked: BlockedIssue[]
  blockedTotal: number
  /** ⚠️ The window the server actually used — it clamps rather than refusing, so label from this. */
  days: number
}

export function fetchDashboardSummary(days: number) {
  return httpClient
    .get<DashboardSummary>("/dashboard/summary", { params: { days } })
    .then((response) => response.data)
}

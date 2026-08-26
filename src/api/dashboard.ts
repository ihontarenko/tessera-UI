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

/**
 * How many issues are sitting in one status **right now**.
 *
 * ⚠️ **Standing, not movement — the other half of `StatusMovement`.** An issue is counted once, where
 * it is, so these sum to `openTotal`; movement counts moves and can exceed the number of issues that
 * exist. Only what is on a board is here: unresolved and unarchived.
 */
export interface StatusStanding {
  status: string
  category: StatusCategory | null
  count: number
}

/**
 * How many open issues are of one kind.
 *
 * ⚠️ **`standing`'s other half.** That says *where* the open work sits; this says *what it is*, on the
 * same population — so these sum to `openTotal` too.
 *
 * ⚠️ **No zero rows, unlike `standing`.** The issue-type catalogue is global and holds every kind any
 * project ever configured; zero-filling it would print rows for kinds this installation has never
 * raised. An absent type here means nobody has one open, not that the row failed to render.
 *
 * ⚠️ `iconKey` is the key, not a colour — the interface owns what a Bug looks like, and it is null for
 * a type with no icon configured.
 */
export interface TypeStanding {
  type: string
  iconKey: string | null
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
 * One day weighed from both sides — estimate arriving against estimate leaving.
 *
 * ⚠️ **The same day as `FlowPoint`, in different units, and never a third bar on it.** Two counts share
 * an axis because the comparison between them means something; a weight against a count invites a
 * comparison that does not — "twelve raised, eight delivered" is not eight of the twelve.
 *
 * ⚠️ **Both sides, because one alone answers nothing.** This carried only `delivered`, as a running
 * total, and a cumulative line only ever goes up: with no reference on the plot a good week and a bad
 * one differ by a slope nobody reads. `raised` is that reference.
 *
 * ⚠️ **Both figures are POSITIVE.** The chart draws one downward — that is a choice about where zero
 * sits, not a fact about the day.
 *
 * ⚠️ **Both count only issues that carried an estimate.** An unestimated one adds to neither side, so
 * both are always under-reports — read them against `estimatedCreatedInWindow` and
 * `estimatedResolvedInWindow`, which is the whole reason those fields exist.
 */
export interface WeightPoint {
  date: string
  raised: number
  delivered: number
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
  /**
   * ⚠️ Together these two are the denominator the weight figures are only honest beside: every weight
   * on this screen counts estimated issues alone, so a team that estimates half its work otherwise
   * reads as one that did half as much.
   */
  estimatedCreatedInWindow: number
  estimatedResolvedInWindow: number
  raisedPointsToday: number
  deliveredPointsToday: number
  weightPerDay: WeightPoint[]
  movedInto: StatusMovement[]
  /** Where the open work sits right now, busiest first — the counts sum to `openTotal`. */
  standing: StatusStanding[]
  /** The same open issues counted by kind, commonest first — ⚠️ no zero rows, see `TypeStanding`. */
  byType: TypeStanding[]
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

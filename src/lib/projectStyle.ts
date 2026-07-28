import type { BoardScopeStrategy } from "@/api/sprints"

/**
 * Everything the interface says about a project's *style* — the word Scrum or Kanban, which tab it
 * opens on, and whether the sprint-only screens apply — derived from the one field that stores it.
 *
 * A project used to carry a `type` alongside its board's scope strategy, and nothing kept the two in
 * agreement: a Kanban-typed project switched onto sprints kept its "Kanban" badge while showing a
 * sprint header and a backlog. The type is gone (ADR-0015); the strategy is the only stored fact, and
 * these answers are computed from it every render. A label that is derived cannot go stale.
 *
 * Deliberately free of React — no hooks, no JSX, no imports beyond the strategy's type. That keeps it
 * callable from anywhere (a table cell, a page header, a future export) and testable without a
 * renderer, and it is why the rule lives in exactly one place rather than in each component that
 * happens to need the word.
 */

/** The tab keys `ProjectDetailPage` renders. Named here so `defaultTab` below cannot pick a missing one. */
type ProjectTab = "issues" | "board" | "backlog" | "reports" | "overview" | "settings" | "access"

interface ProjectStyle {
  /** The human word, for a badge or a page header. */
  label: string
  /**
   * The tab a project opens on. A continuous-flow team lives on the board, so that is where Kanban
   * lands; a team planning in sprints starts from the issue list, since its board shows only whatever
   * sprint happens to be running — and nothing at all between sprints.
   */
  defaultTab: ProjectTab
  /**
   * Whether sprints apply at all — the Reports tab, the sprint panels on the backlog and the controls
   * that commit work to one. Not the backlog itself: every project has that (ADR-0016).
   */
  plansInSprints: boolean
}

/**
 * One row per strategy, so the three questions are answered from a single table rather than by three
 * separate branches that could drift apart. `Record` keyed on the strategy means a new strategy is a
 * type error here rather than a silent fallthrough at each call site.
 */
const PROJECT_STYLES: Record<BoardScopeStrategy, ProjectStyle> = {
  ACTIVE_SPRINT: { label: "Scrum", defaultTab: "issues", plansInSprints: true },
  ALL_ISSUES: { label: "Kanban", defaultTab: "board", plansInSprints: false },
}

export function projectStyleLabel(boardScopeStrategy: BoardScopeStrategy): string {
  return PROJECT_STYLES[boardScopeStrategy].label
}

export function defaultProjectTab(boardScopeStrategy: BoardScopeStrategy): ProjectTab {
  return PROJECT_STYLES[boardScopeStrategy].defaultTab
}

export function plansInSprints(boardScopeStrategy: BoardScopeStrategy): boolean {
  return PROJECT_STYLES[boardScopeStrategy].plansInSprints
}

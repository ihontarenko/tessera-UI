import type { BoardScopeStrategy } from "@/api/sprints"

/**
 * Everything the interface says about a project's *shape* — the word Scrum or Kanban, which tabs it
 * has, which one it opens on, and what Settings is divided into — derived from the one field that
 * stores it.
 *
 * A project used to carry a `type` alongside its board's scope strategy, and nothing kept the two in
 * agreement: a Kanban-typed project switched onto sprints kept its "Kanban" badge while showing a
 * sprint header and a backlog. The type is gone (ADR-0015); the strategy is the only stored fact, and
 * these answers are computed from it every render. A label that is derived cannot go stale.
 *
 * Deliberately free of React — no hooks, no JSX, no imports beyond the strategy's type. That keeps it
 * callable from anywhere (a table cell, a page header, a future export) and testable without a
 * renderer, and it is why the rules live in exactly one place rather than in each component that
 * happens to need them.
 */

/** The tabs `ProjectDetailPage` renders. Named here so nothing below can name one that has no panel. */
export type ProjectTab = "issues" | "board" | "backlog" | "reports" | "settings"

/**
 * Tabs that used to exist and no longer do, each pointing at where its content went. A bookmark or a
 * pasted link outlives the tab strip it was made from, so a dead tab resolves to the live one that
 * absorbed it rather than dropping the visitor on the default (ticket 06).
 */
const RETIRED_TABS: Record<string, ProjectTab> = {
  overview: "settings",
  access: "settings",
}

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
 * One row per strategy, so the questions are answered from a single table rather than by separate
 * branches that could drift apart. `Record` keyed on the strategy means a new strategy is a type error
 * here rather than a silent fallthrough at each call site.
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

/**
 * The tabs this project has, in the order they are shown. Reports is the only conditional one: Issues,
 * Board, Backlog and Settings apply to every project however it plans.
 */
export function projectTabs(boardScopeStrategy: BoardScopeStrategy): ProjectTab[] {
  return [
    "issues",
    "board",
    "backlog",
    ...(plansInSprints(boardScopeStrategy) ? (["reports"] as const) : []),
    "settings",
  ]
}

/**
 * Which tab a `?tab=` value should actually open. A tab that no longer exists at all resolves through
 * {@link RETIRED_TABS}; one that exists but does not apply to this project — Reports on a board showing
 * every issue — falls back to the default, as does anything unrecognised. The page therefore never
 * renders a trigger with no panel behind it.
 */
export function resolveProjectTab(requestedTab: string | null, boardScopeStrategy: BoardScopeStrategy): ProjectTab {
  const requested = requestedTab ?? ""
  const candidate = RETIRED_TABS[requested] ?? requested
  const available = projectTabs(boardScopeStrategy)

  return available.includes(candidate as ProjectTab) ? (candidate as ProjectTab) : defaultProjectTab(boardScopeStrategy)
}

/**
 * Settings is one destination with sections rather than three tabs and a sheet (ticket 06). The list is
 * the same for every project: what a section *contains* varies, but whether a project can be
 * administered is a permission question, not a shape question, and a section that turns out to be
 * read-only still belongs in the list.
 */
export type ProjectSettingsSection = "general" | "issue-types" | "workflow" | "board" | "access"

export const PROJECT_SETTINGS_SECTIONS: ProjectSettingsSection[] = [
  "general",
  "issue-types",
  "workflow",
  "board",
  "access",
]

export function resolveProjectSettingsSection(requestedSection: string | null): ProjectSettingsSection {
  const requested = (requestedSection ?? "") as ProjectSettingsSection

  return PROJECT_SETTINGS_SECTIONS.includes(requested) ? requested : "general"
}

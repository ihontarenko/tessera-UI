import type { BacklogIssue, BacklogMoveRequest, BacklogPanel, BacklogResponse } from "@/api/sprints"
import type { TranslatableText } from "@/lib/translatableText"

/**
 * The backlog screen's pure layer: turning the server payload into the ordered sections the screen
 * renders, and applying a drag to it optimistically. Hook-free and string-free — a section's title is
 * a {@link TranslatableText} (a key plus its English), so this module stays testable and translatable
 * while the rendering component resolves the copy. Same seam discipline as the board's `swimlanes` and
 * `boardFilters`.
 */

/** The drop-target id of the product backlog — sprints use their own id. */
export const BACKLOG_SECTION_ID = "__backlog__"

export type BacklogSectionKind = "activeSprint" | "futureSprint" | "backlog"

export interface BacklogSection {
  /** Stable key for rendering and for identifying the drop target. */
  id: string
  /** What a move request into this section carries — null is the product backlog. */
  targetSprintId: string | null
  kind: BacklogSectionKind
  /** A sprint's own name is user data and renders verbatim; the backlog's title is UI copy. */
  title: TranslatableText
  panel: BacklogPanel
}

/** Top to bottom, the way the screen reads: what is running, what is planned, what is merely known. */
export function toSections(backlog: BacklogResponse): BacklogSection[] {
  const sections: BacklogSection[] = []

  if (backlog.activeSprint?.sprint) {
    sections.push(sprintSection(backlog.activeSprint, "activeSprint"))
  }

  for (const panel of backlog.futureSprints) {
    if (panel.sprint) {
      sections.push(sprintSection(panel, "futureSprint"))
    }
  }

  sections.push({
    id: BACKLOG_SECTION_ID,
    targetSprintId: null,
    kind: "backlog",
    title: { key: "backlog.panel.backlog", text: "Backlog" },
    panel: backlog.backlog,
  })

  return sections
}

/**
 * The screen as it will look once the server agrees — the dragged issue spliced into its new section at
 * the position the drop implied, with both affected panels' counts and totals recomputed. Reconciled
 * with the server's own response when the move lands, and rolled back if it does not.
 *
 * An issue key that is nowhere on the screen leaves the payload untouched rather than inventing a row.
 */
export function applyMove(backlog: BacklogResponse, request: BacklogMoveRequest): BacklogResponse {
  const dragged = allIssues(backlog).find((issue) => issue.issueKey === request.issueKey)

  if (!dragged) {
    return backlog
  }

  const place = (panel: BacklogPanel): BacklogPanel => {
    const remaining = panel.issues.filter((issue) => issue.issueKey !== request.issueKey)
    const isTarget = (panel.sprint?.id ?? null) === request.targetSprintId

    if (!isTarget) {
      return panelWith(panel, remaining)
    }

    const placed = [...remaining]
    placed.splice(insertionIndex(remaining, request), 0, dragged)

    return panelWith(panel, placed)
  }

  return {
    ...backlog,
    activeSprint: backlog.activeSprint ? place(backlog.activeSprint) : backlog.activeSprint,
    futureSprints: backlog.futureSprints.map(place),
    backlog: place(backlog.backlog),
  }
}

/** Where the drop lands, from the two neighbours the member could actually see. */
function insertionIndex(issues: BacklogIssue[], request: BacklogMoveRequest): number {
  if (request.afterIssueKey) {
    const afterIndex = issues.findIndex((issue) => issue.issueKey === request.afterIssueKey)

    if (afterIndex !== -1) {
      return afterIndex
    }
  }

  if (request.beforeIssueKey) {
    const beforeIndex = issues.findIndex((issue) => issue.issueKey === request.beforeIssueKey)

    if (beforeIndex !== -1) {
      return beforeIndex + 1
    }
  }

  return issues.length
}

/** A panel around a new issue list, with the two derived numbers kept honest. An unestimated issue
 *  counts as zero points but is still counted — a missing estimate should be obvious, not invisible. */
function panelWith(panel: BacklogPanel, issues: BacklogIssue[]): BacklogPanel {
  return {
    ...panel,
    issues,
    issueCount: issues.length,
    storyPointTotal: issues.reduce((total, issue) => total + (issue.storyPoints ?? 0), 0),
  }
}

function sprintSection(panel: BacklogPanel, kind: BacklogSectionKind): BacklogSection {
  return {
    id: panel.sprint?.id ?? BACKLOG_SECTION_ID,
    targetSprintId: panel.sprint?.id ?? null,
    kind,
    title: { key: null, text: panel.sprint?.name ?? "" },
    panel,
  }
}

function allIssues(backlog: BacklogResponse): BacklogIssue[] {
  return [
    ...(backlog.activeSprint?.issues ?? []),
    ...backlog.futureSprints.flatMap((panel) => panel.issues),
    ...backlog.backlog.issues,
  ]
}

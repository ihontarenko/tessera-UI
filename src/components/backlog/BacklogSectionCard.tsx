import { Fragment, useState } from "react"
import type { DragEvent, ReactNode } from "react"
import { MemberChip } from "@/components/MemberChip"
import { IssueTypeIcon, PriorityBadge } from "@/components/issues/issueVisuals"
import { StoryPointsField } from "@/components/backlog/StoryPointsField"
import type { EstimationSchemeSummary } from "@/api/projects"
import type { BacklogSection } from "@/components/backlog/backlogSections"
import { useLanguage } from "@/context/LanguageContext"
import type { BacklogIssue, BacklogMoveRequest } from "@/api/sprints"
import { cn, formatPointTotal } from "@/lib/helpers"
import { resolveText } from "@/lib/translatableText"

/**
 * One section of the backlog screen — a sprint's panel or the product backlog — with its header
 * numbers and its drop zone. Every section is both a drag source and a drop target, so backlog →
 * sprint, sprint → sprint, sprint → backlog and reordering within one section are all the same
 * interaction. Native HTML5 drag-and-drop, no library, matching the board's Phase-2 decision.
 *
 * Neighbours for the move request are read from what this section is showing, so a drop ranks the issue
 * between the two rows the member could actually see.
 */
export function BacklogSectionCard({
  section,
  estimationScheme,
  canDrag,
  canEditStoryPoints,
  onSelectIssue,
  onMove,
  onChangeStoryPoints,
  actions,
}: {
  section: BacklogSection
  /** The project's scale, or null where it does not estimate — then the column is simply absent. */
  estimationScheme: EstimationSchemeSummary | null
  canDrag: boolean
  canEditStoryPoints: boolean
  onSelectIssue: (issueId: string) => void
  onMove: (request: BacklogMoveRequest) => void
  onChangeStoryPoints: (issueId: string, storyPoints: number | null) => void
  actions?: ReactNode
}) {
  const { t } = useLanguage()
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const { panel } = section
  const goal = section.kind === "backlog" ? null : panel.sprint?.goal

  function computeDropIndex(event: DragEvent<HTMLElement>, index: number) {
    const boundingRectangle = event.currentTarget.getBoundingClientRect()
    const isAbove = event.clientY < boundingRectangle.top + boundingRectangle.height / 2

    return isAbove ? index : index + 1
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const issueKey = event.dataTransfer.getData("text/plain")
    const index = dropIndex ?? panel.issues.length
    setDropIndex(null)

    if (!issueKey) {
      return
    }

    const withoutDragged = panel.issues.filter((issue) => issue.issueKey !== issueKey)
    const clampedIndex = Math.min(index, withoutDragged.length)
    const beforeIssue = clampedIndex > 0 ? withoutDragged[clampedIndex - 1] : undefined
    const afterIssue = clampedIndex < withoutDragged.length ? withoutDragged[clampedIndex] : undefined

    onMove({
      issueKey,
      targetSprintId: section.targetSprintId,
      beforeIssueKey: beforeIssue?.issueKey ?? null,
      afterIssueKey: afterIssue?.issueKey ?? null,
    })
  }

  return (
    <section className="rounded-lg border bg-muted/20">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
        <h3 className="font-display text-sm font-semibold tracking-[-0.01em]">{resolveText(t, section.title)}</h3>

        {section.kind === "activeSprint" && (
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {t("sprint.state.active", "Active")}
          </span>
        )}

        <span className="text-xs tabular-nums text-muted-foreground">
          {t("backlog.panel.summary", "{issues} issues · {points} points", {
            issues: panel.issueCount,
            points: formatPointTotal(panel.storyPointTotal),
          })}
        </span>

        {goal ? <span className="truncate text-xs italic text-muted-foreground">{goal}</span> : null}

        {actions ? <div className="ml-auto flex items-center gap-1.5">{actions}</div> : null}
      </header>

      <div
        className="flex min-h-16 flex-col gap-1 p-2"
        onDragOver={(event) => {
          if (!canDrag) {
            return
          }
          event.preventDefault()
          if (dropIndex === null) {
            setDropIndex(panel.issues.length)
          }
        }}
        onDragLeave={() => setDropIndex(null)}
        onDrop={canDrag ? handleDrop : undefined}
      >
        {panel.issues.length === 0 && dropIndex === null ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">
            {resolveText(t, section.emptyMessage)}
          </p>
        ) : (
          panel.issues.map((issue, index) => (
            <Fragment key={issue.id}>
              {dropIndex === index && <DropPlaceholder />}
              <BacklogRow
                issue={issue}
                draggable={canDrag}
                estimationScheme={estimationScheme}
                canEditStoryPoints={canEditStoryPoints}
                onSelect={onSelectIssue}
                onChangeStoryPoints={onChangeStoryPoints}
                onDragStart={(event) => event.dataTransfer.setData("text/plain", issue.issueKey)}
                onDragOver={(event) => {
                  if (!canDrag) {
                    return
                  }
                  event.preventDefault()
                  event.stopPropagation()
                  setDropIndex(computeDropIndex(event, index))
                }}
              />
            </Fragment>
          ))
        )}
        {dropIndex === panel.issues.length && panel.issues.length > 0 && <DropPlaceholder />}
      </div>
    </section>
  )
}

function DropPlaceholder() {
  return <div className="h-9 shrink-0 rounded-md border-2 border-dashed border-primary/50 bg-primary/5" />
}

/**
 * One row. The summary is its own button so the row stays a plain draggable container — an estimate
 * field nested inside a button would be invalid markup and unclickable.
 */
function BacklogRow({
  issue,
  draggable,
  estimationScheme,
  canEditStoryPoints,
  onSelect,
  onChangeStoryPoints,
  onDragStart,
  onDragOver,
}: {
  issue: BacklogIssue
  draggable: boolean
  estimationScheme: EstimationSchemeSummary | null
  canEditStoryPoints: boolean
  onSelect: (issueId: string) => void
  onChangeStoryPoints: (issueId: string, storyPoints: number | null) => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 shadow-sm transition-colors hover:border-primary/40",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <IssueTypeIcon type={issue.type} />

      <button
        type="button"
        onClick={() => onSelect(issue.id)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{issue.issueKey}</span>
        <span className={cn("truncate text-sm", issue.open ? "" : "text-muted-foreground line-through")}>
          {issue.summary}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <PriorityBadge priority={issue.priority} />
        {issue.assignee ? <MemberChip member={issue.assignee} className="[&_.text-sm]:hidden" /> : null}
        <StoryPointsField
          scheme={estimationScheme}
          storyPoints={issue.storyPoints}
          editable={canEditStoryPoints}
          onCommit={(storyPoints) => onChangeStoryPoints(issue.id, storyPoints)}
        />
      </div>
    </div>
  )
}

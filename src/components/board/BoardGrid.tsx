import { Fragment, useMemo, useState } from "react"
import type { DragEvent } from "react"
import { Ban } from "lucide-react"
import { MemberChip } from "@/components/MemberChip"
import { IssueTypeIcon, PriorityBadge, issueTypeBorderClass } from "@/components/issues/issueVisuals"
import type { Swimlane } from "@/components/board/swimlanes"
import { useLanguage } from "@/context/LanguageContext"
import type { BoardCard, BoardColumnView, BoardMoveRequest } from "@/api/boards"
import { cn } from "@/lib/helpers"
import { resolveText } from "@/lib/translatableText"

/** Every column cell — header and drop zone alike — shares this width so the grid stays aligned. */
const COLUMN_WIDTH = "w-72 shrink-0"

/**
 * The board grid: one row of column headers over one row of drop zones per swimlane (ticket 04). With
 * `NONE` there is a single titleless lane, so the flat board is the same code path, not a branch.
 *
 * Headers are hoisted out of the lanes deliberately — a WIP limit describes a *stage*, not a lane, so
 * it is rendered once rather than per lane, and its count comes from `cardsOnBoard` (every card the
 * board holds) rather than from the lanes (what this viewer is looking at). Turning on a quick filter
 * must not make an over-max column stop flagging: the breach is real either way (spec, story 30).
 *
 * A card dropped into a different lane's column changes only its column and rank; lane membership is
 * derived from the card's own assignee/epic/priority, so it settles back into its own lane. Dragging
 * *between* lanes to reassign is not a Phase-2 behaviour.
 */
export function BoardGrid({
  columns,
  swimlanes,
  cardsOnBoard,
  canDrag,
  onSelectCard,
  onMove,
}: {
  columns: BoardColumnView[]
  swimlanes: Swimlane[]
  cardsOnBoard: BoardCard[]
  canDrag: boolean
  onSelectCard: (issueId: string) => void
  onMove: (request: BoardMoveRequest) => void
}) {
  const { t } = useLanguage()

  const countsByColumn = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of cardsOnBoard) {
      // `!= null`: a card whose status maps to no column is in the backlog (ADR-0016), and the field
      // can arrive either absent or null depending on how the payload was serialised.
      if (card.columnId != null) {
        counts.set(card.columnId, (counts.get(card.columnId) ?? 0) + 1)
      }
    }
    return counts
  }, [cardsOnBoard])

  const cardsByLaneAndColumn = useMemo(() => {
    const byLane = new Map<string, Map<string, BoardCard[]>>()
    for (const lane of swimlanes) {
      const byColumn = new Map<string, BoardCard[]>()
      for (const card of lane.cards) {
        if (card.columnId == null) {
          continue
        }
        const bucket = byColumn.get(card.columnId) ?? []
        bucket.push(card)
        byColumn.set(card.columnId, bucket)
      }
      byLane.set(lane.id, byColumn)
    }
    return byLane
  }, [swimlanes])

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-max space-y-4">
        <div className="flex gap-3">
          {columns.map((column) => (
            <ColumnHeader key={column.id} column={column} count={countsByColumn.get(column.id) ?? 0} />
          ))}
        </div>

        {swimlanes.map((lane) => (
          <section key={lane.id} className="space-y-1.5">
            {lane.title !== null && (
              <header className="flex items-center gap-2 px-0.5">
                <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {resolveText(t, lane.title)}
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground/70">{lane.cards.length}</span>
                <div className="h-px flex-1 bg-border" />
              </header>
            )}

            <div className="flex gap-3">
              {columns.map((column) => (
                <ColumnDropZone
                  key={column.id}
                  column={column}
                  cards={cardsByLaneAndColumn.get(lane.id)?.get(column.id) ?? []}
                  canDrag={canDrag}
                  onSelectCard={onSelectCard}
                  onMove={onMove}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/** Column name and its WIP state — over-max and under-min highlight, never enforce (soft limits). The
 *  column's own name is administrator-authored data and stays untranslated. */
function ColumnHeader({ column, count }: { column: BoardColumnView; count: number }) {
  const { t } = useLanguage()
  // Destructured so the null checks narrow the limits for the tooltip below, not just for the styling.
  const { minIssues, maxIssues } = column
  const overMax = maxIssues != null && count > maxIssues
  const underMin = minIssues != null && count < minIssues

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2",
        COLUMN_WIDTH,
        overMax && "border-destructive/60",
        underMin && "border-amber-500/60",
      )}
    >
      <span className="truncate text-sm font-medium">{column.name}</span>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-xs tabular-nums",
          overMax
            ? "bg-destructive/15 text-destructive-ink"
            : underMin
              ? "bg-amber-500/15 text-amber-600"
              : "bg-background text-muted-foreground",
        )}
        title={
          overMax
            ? t("board.column.overLimit", "Over the limit of {maximum}", { maximum: maxIssues })
            : underMin
              ? t("board.column.underMinimum", "Under the minimum of {minimum}", { minimum: minIssues })
              : undefined
        }
      >
        {count}
        {maxIssues != null ? ` / ${maxIssues}` : ""}
      </span>
    </div>
  )
}

/**
 * One lane's slice of one column — the card stack and its drop target. Neighbours for the move request
 * are read from this slice, so a reorder ranks the card between what the member can actually see; with
 * a filter or swimlane active that is a narrower set than the global order (the accepted LexoRank
 * trade-off, ADR-0006).
 */
function ColumnDropZone({
  column,
  cards,
  canDrag,
  onSelectCard,
  onMove,
}: {
  column: BoardColumnView
  cards: BoardCard[]
  canDrag: boolean
  onSelectCard: (issueId: string) => void
  onMove: (request: BoardMoveRequest) => void
}) {
  const { t } = useLanguage()
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  function computeDropIndex(event: DragEvent<HTMLElement>, index: number) {
    const boundingRectangle = event.currentTarget.getBoundingClientRect()
    const isAbove = event.clientY < boundingRectangle.top + boundingRectangle.height / 2
    return isAbove ? index : index + 1
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const issueKey = event.dataTransfer.getData("text/plain")
    const index = dropIndex ?? cards.length
    setDropIndex(null)

    if (!issueKey) {
      return
    }

    const withoutDragged = cards.filter((card) => card.issueKey !== issueKey)
    const clampedIndex = Math.min(index, withoutDragged.length)
    const beforeCard = clampedIndex > 0 ? withoutDragged[clampedIndex - 1] : undefined
    const afterCard = clampedIndex < withoutDragged.length ? withoutDragged[clampedIndex] : undefined

    onMove({
      issueKey,
      targetColumnId: column.id,
      beforeIssueKey: beforeCard?.issueKey ?? null,
      afterIssueKey: afterCard?.issueKey ?? null,
    })
  }

  return (
    <div
      className={cn("flex min-h-24 flex-col gap-2 rounded-lg border bg-muted/30 p-2", COLUMN_WIDTH)}
      onDragOver={(event) => {
        if (!canDrag) {
          return
        }
        event.preventDefault()
        if (dropIndex === null) {
          setDropIndex(cards.length)
        }
      }}
      onDragLeave={() => setDropIndex(null)}
      onDrop={canDrag ? handleDrop : undefined}
    >
      {cards.length === 0 && dropIndex === null ? (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">{t("board.column.empty", "No issues")}</p>
      ) : (
        cards.map((card, index) => (
          <Fragment key={card.id}>
            {dropIndex === index && <DropPlaceholder />}
            <IssueCard
              card={card}
              draggable={canDrag}
              onSelect={onSelectCard}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", card.issueKey)}
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
      {dropIndex === cards.length && cards.length > 0 && <DropPlaceholder />}
    </div>
  )
}

function DropPlaceholder() {
  return <div className="h-14 shrink-0 rounded-md border-2 border-dashed border-primary/50 bg-primary/5" />
}

function IssueCard({
  card,
  draggable,
  onSelect,
  onDragStart,
  onDragOver,
}: {
  card: BoardCard
  draggable: boolean
  onSelect: (issueId: string) => void
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onClick={() => onSelect(card.id)}
      className={cn(
        // The accent edge is the issue type's own colour (TSSR-22) — the same hue its icon is drawn
        // in, so a column reads as a mix of bugs and stories without anybody reading a word.
        //
        // ⚠️ The hover recolours three sides, not four. `hover:border-primary/40` on its own repaints
        // the left edge too and wipes the accent out exactly when somebody is pointing at the card.
        //
        // pl-2 against p-2.5 keeps the text where it was: the edge grows from 1px to 4px, so the
        // padding gives the 3px back rather than letting every card shift on its own.
        "flex w-full flex-col gap-2 rounded-md border border-l-4 bg-background p-2.5 pl-2 text-left shadow-sm transition-colors hover:border-y-primary/40 hover:border-r-primary/40",
        issueTypeBorderClass(card.type),
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <span className={cn("text-sm", card.open ? "" : "text-muted-foreground line-through")}>{card.summary}</span>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <IssueTypeIcon type={card.type} />
          {/* ⚠️ A mark, not a list (TSSR-41). This is the screen where somebody decides what to pick
              up next, and that decision needs "not this one" — the keys are on the issue itself. */}
          {card.blocked && (
            <Ban className="size-3.5 shrink-0 text-warning" aria-label="Blocked">
              <title>Something unresolved is holding this up</title>
            </Ban>
          )}
          <span className="font-mono text-xs text-muted-foreground">{card.issueKey}</span>
        </span>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={card.priority} />
          {card.assignee ? <MemberChip member={card.assignee} className="[&_.text-sm]:hidden" /> : null}
        </div>
      </div>
    </button>
  )
}

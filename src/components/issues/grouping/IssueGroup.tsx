import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@jmouse/ui"
import { IssueTypeIcon, StatusPill, issueTypeBorderClass } from "@/components/issues/issueVisuals"
import { IssueRowLayout } from "@/components/issues/rows/IssueListRow"
import type { IssueTypeSummary, StatusSummary } from "@/api/issues"
import { cn } from "@/lib/helpers"

/**
 * A heading issue with the issues gathered under it — the shape both grouped screens are made of.
 *
 * ⚠️ **Deliberately not a card, and deliberately not a `Table`.** It was both: a bordered card holding a
 * bordered table with its own header row, for registers that are usually two lines long — Ivan's *"не гарно
 * коли воно одне в одному"*. A group is now a heading and an aligned list, and a hairline is what separates it
 * from the next one.
 *
 * ⚠️ **One component for two sources on purpose.** A register groups by *link* across projects; the Epics
 * view groups by *hierarchy* inside one. Same answer shape, so the same component — and the rows themselves
 * are {@link IssueListRow}, which every list in the product now shares (TSSR-53).
 */
export function IssueGroup({
  issueKey,
  summary,
  type,
  status,
  open = true,
  projectKey,
  caption,
  done,
  total,
  withProject = true,
  children,
  footer,
}: {
  issueKey: string
  summary: string
  type: IssueTypeSummary | null
  status: StatusSummary | null
  open?: boolean
  projectKey?: string | null
  /** Anything extra for the quiet second line — a type name, a count of something else. */
  caption?: ReactNode
  done: number
  total: number
  /** Whether the rows carry a project column — see `IssueRowLayout`. */
  withProject?: boolean
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    // ⚠️ The accent edge is the heading issue's **type** colour, drawn by the same helper the board's cards
    // use (TSSR-22). Colour that means something is worth having; a decorative stripe in the theme accent
    // would be one more thing on screen saying nothing. An unknown type gets a transparent edge, never grey.
    <section className={cn("border-l-4 py-3 pl-3 first:pt-0 last:pb-0", issueTypeBorderClass(type))}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <IssueTypeIcon type={type} />
        <Link
          to={`/issues/${issueKey}`}
          className={cn(
            "min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.01em] hover:underline",
            !open && "text-muted-foreground line-through",
          )}
        >
          {summary}
        </Link>
        <StatusPill status={status} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {projectKey && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {projectKey}
          </Badge>
        )}
        <Link to={`/issues/${issueKey}`} className="font-mono hover:underline">
          {issueKey}
        </Link>
        {caption && (
          <>
            <span className="opacity-60">·</span>
            <span>{caption}</span>
          </>
        )}

        {total > 0 && <ProgressMeter done={done} total={total} />}
      </div>

      <IssueRowLayout withProject={withProject} className="mt-2">
        {children}
      </IssueRowLayout>

      {footer}
    </section>
  )
}

/**
 * How much of the group is finished.
 *
 * ⚠️ **The one number this whole screen exists for, so it is drawn like it.** It was a 2px grey sliver and a
 * muted count — the least visible thing in a group whose entire purpose is answering *how far along is this*.
 *
 * ⚠️ **The colour is the state, not decoration**: emerald once everything is done, the theme accent while it
 * is in flight, and a bare track at zero — because a coloured bar showing no progress reads, for a moment, as
 * progress. Finished also thickens the count's weight, so the answer survives being read at a glance in a
 * list of ten.
 */
export function ProgressMeter({ done, total }: { done: number; total: number }) {
  const percent = Math.round((done / total) * 100)
  const isComplete = done === total
  const hasStarted = done > 0

  return (
    <span className="ml-auto flex shrink-0 items-center gap-2" title={`${percent}% done`}>
      <span
        className={cn(
          "tabular-nums",
          isComplete ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-medium text-foreground/80",
        )}
      >
        {done} of {total} done
      </span>
      <span
        aria-hidden
        className="h-2 w-32 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border/60"
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-300",
            isComplete ? "bg-emerald-500" : hasStarted ? "bg-primary" : "bg-transparent",
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
    </span>
  )
}

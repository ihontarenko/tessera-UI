import { createContext, useContext, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { IssueTypeIcon, StatusPill, issueTypeBorderClass } from "@/components/issues/issueVisuals"
import type { IssueTypeSummary, StatusSummary } from "@/api/issues"
import { cn } from "@/lib/helpers"

/**
 * The column layout every row in one group shares.
 *
 * ⚠️ **A table's alignment without a table's header** (Ivan: *"давай список буде як таблиця, але без
 * хедера"*). Rows were a flex line, so each one placed its key and its summary wherever the text before it
 * ended — a list of ten had ten different left edges for the same field, which is what made it read as loose
 * text rather than as a list of issues. One grid template, held by the group and applied by every row, buys
 * the alignment; the header row is what a group's heading already says.
 *
 * ⚠️ **The template lives here rather than on each row** because the columns must agree *within* a group and
 * are allowed to differ *between* them: a register spans projects and needs a project column, the Epics view
 * is one project and would draw an empty one.
 */
interface GroupColumns {
  template: string
  withProject: boolean
}

const WITH_PROJECT: GroupColumns = {
  template: "1.25rem 5.5rem 4rem minmax(0,1fr) auto",
  withProject: true,
}

const WITHOUT_PROJECT: GroupColumns = {
  template: "1.25rem 5.5rem minmax(0,1fr) auto",
  withProject: false,
}

const GroupColumnsContext = createContext<GroupColumns>(WITHOUT_PROJECT)

/**
 * A heading issue with the issues gathered under it — the shape both grouped screens are made of.
 *
 * ⚠️ **Deliberately not a card, and deliberately not a `Table`.** It was both: a bordered card holding a
 * bordered table with its own header row, for registers that are usually two lines long — Ivan's *"не гарно
 * коли воно одне в одному"*. A group is now a heading and an aligned list, and a hairline is what separates it
 * from the next one. The same call `IssueActivityStream` made and for the same reason: a box around short
 * content reads as an empty box.
 *
 * ⚠️ **One component for two sources on purpose.** A register groups by *link* across projects; the Epics
 * view groups by *hierarchy* inside one. Those are different questions with the same answer shape, and two
 * copies of this markup would drift into two different-looking answers.
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
  /** Whether the rows carry a project column — see {@link GroupColumns}. */
  withProject?: boolean
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <GroupColumnsContext.Provider value={withProject ? WITH_PROJECT : WITHOUT_PROJECT}>
      {/* ⚠️ The accent edge is the heading issue's **type** colour, drawn by the same helper the board's
          cards use (TSSR-22). Colour that means something is worth having; a decorative stripe in the theme
          accent would be one more thing on screen saying nothing. A type this build has never heard of gets
          a transparent edge rather than a grey one — see `issueTypeBorderClass`. */}
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

        <ul className="mt-2">{children}</ul>

        {footer}
      </section>
    </GroupColumnsContext.Provider>
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
function ProgressMeter({ done, total }: { done: number; total: number }) {
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

/**
 * One issue inside a group — a row of aligned cells, without a header row above them.
 *
 * ⚠️ **The trailing controls are one cell rather than columns of their own.** A register's row carries a
 * link-type select and an unlink button; an epic's row carries an estimate and an assignee. Columns would
 * have to exist in both and stand empty in one, which is how a table ends up wider than anything in it.
 */
export function IssueGroupRow({
  issueKey,
  summary,
  type,
  status,
  open = true,
  projectKey,
  readable = true,
  trailing,
}: {
  issueKey: string
  /** Null exactly when `readable` is false — the far side of a link may be in a project the reader cannot see. */
  summary: string | null
  type: IssueTypeSummary | null
  status: StatusSummary | null
  open?: boolean
  projectKey?: string | null
  readable?: boolean
  trailing?: ReactNode
}) {
  const columns = useContext(GroupColumnsContext)

  return (
    <li
      className="group/row grid items-center gap-2 border-b border-border/40 px-1 py-1.5 text-sm last:border-b-0 hover:bg-muted/50"
      style={{ gridTemplateColumns: columns.template }}
    >
      <IssueTypeIcon type={type} />

      {/* ⚠️ A redacted reference carries no id and therefore no way in (TSSR-43). Shown rather than dropped:
          a group that silently omits items is a group that lies about its own count. */}
      {readable ? (
        <Link to={`/issues/${issueKey}`} className="truncate font-mono text-xs text-muted-foreground hover:underline">
          {issueKey}
        </Link>
      ) : (
        <span className="truncate font-mono text-xs text-muted-foreground">{issueKey}</span>
      )}

      {columns.withProject &&
        (projectKey ? (
          <Badge variant="outline" className="w-fit font-mono text-[10px]">
            {projectKey}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ))}

      {readable ? (
        <Link
          to={`/issues/${issueKey}`}
          className={cn("min-w-0 truncate hover:underline", !open && "text-muted-foreground line-through")}
        >
          {summary}
        </Link>
      ) : (
        <span className="min-w-0 truncate text-xs italic text-muted-foreground" title="In a project you are not a member of">
          in a project you cannot see
        </span>
      )}

      <span className="flex items-center justify-end gap-2">
        {trailing}
        <StatusPill status={status} />
      </span>
    </li>
  )
}

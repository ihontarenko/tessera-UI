import { createContext, useContext, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@jmouse/ui"
import { IssueTypeIcon, StatusPill } from "@/components/issues/issueVisuals"
import type { IssueTypeSummary, StatusSummary } from "@/api/issues"
import { cn } from "@/lib/helpers"

/**
 * The one way this product draws an issue in a list (TSSR-53).
 *
 * ⚠️ **There were four.** A `<Table>` with a header on the two dense screens, an aligned header-less grid on
 * the two grouped ones, and a bordered shadowed card per row on Shipped — with the key and the project in a
 * different order between them and the status in a different place. Each was fine alone; together they read
 * as three products, because the same issue under the same key changed shape as you moved between tabs of one
 * screen.
 *
 * ⚠️ **No header anywhere, and the tables lost theirs rather than the lists gaining one.** A group already has
 * a heading, and the columns are an icon, a key, a badge, a sentence and a pill — nobody needs to be told
 * which is which. What a header bought was alignment, and the grid buys that without spending a row on it.
 */
interface IssueRowColumns {
  template: string
  withProject: boolean
}

const WITH_PROJECT: IssueRowColumns = {
  template: "1.25rem 5.5rem 4rem minmax(0,1fr) auto auto",
  withProject: true,
}

const WITHOUT_PROJECT: IssueRowColumns = {
  template: "1.25rem 5.5rem minmax(0,1fr) auto auto",
  withProject: false,
}

const IssueRowColumnsContext = createContext<IssueRowColumns>(WITHOUT_PROJECT)

/**
 * The column layout every row inside it shares.
 *
 * ⚠️ **The template belongs to the list, not to the row.** Columns must agree *within* one list and are
 * allowed to differ *between* them: a cross-project search needs a project column, a list inside one project
 * would draw it empty on every row. A row reading the layout from a prop would let two rows of one list
 * disagree; a row reading a module constant would force a column on the screens that have nothing to put in
 * it.
 */
export function IssueRowLayout({
  withProject = true,
  className,
  children,
}: {
  withProject?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <IssueRowColumnsContext.Provider value={withProject ? WITH_PROJECT : WITHOUT_PROJECT}>
      <ul className={className}>{children}</ul>
    </IssueRowColumnsContext.Provider>
  )
}

/**
 * One issue, as a row.
 *
 * @param onOpen  where the row opens a modal instead of navigating — the screens that already hold one
 *                project's permissions. Omitted, the row is a link to the issue's own page, which resolves
 *                them itself. ⚠️ That difference is *behaviour*, so it stays each screen's choice; the shape
 *                is what this component owns.
 * @param status  drawn last on every screen. A screen that lets the status be *changed* passes its own
 *                control as {@link statusSlot} rather than a second pill somewhere else in the row.
 */
export function IssueListRow({
  issueKey,
  summary,
  type,
  status,
  open = true,
  projectKey,
  readable = true,
  dimmed = false,
  onOpen,
  trailing,
  statusSlot,
}: {
  issueKey: string
  /** Null exactly when `readable` is false — the far side of a link may be in a project the reader cannot see. */
  summary: string | null
  type: IssueTypeSummary | null
  status: StatusSummary | null
  open?: boolean
  projectKey?: string | null
  readable?: boolean
  /** Put away, and saying so by receding — see Shipped, where archived rows stay in the list. */
  dimmed?: boolean
  onOpen?: () => void
  trailing?: ReactNode
  statusSlot?: ReactNode
}) {
  const columns = useContext(IssueRowColumnsContext)

  const summaryClassName = cn(
    "min-w-0 truncate text-left",
    !open && "text-muted-foreground line-through",
    readable && "hover:underline",
  )

  return (
    <li
      className={cn(
        "group/row grid items-center gap-2 border-b border-border/40 px-1 py-1 text-sm last:border-b-0",
        "transition-colors hover:bg-muted/50",
        // ⚠️ **One height for every list, set here rather than left to whatever the row happens to hold.**
        // The height was being decided by the tallest thing in the trailing slot, which differs per screen:
        // a `MemberChip`'s 28px avatar on the search and the project's list, an inline select on a register,
        // a bare pill on Epics. Same component, three heights, and the two screens with people in them were
        // the tall ones. `min-h-8` is the floor and the two rules below are the ceiling — an avatar and a
        // select shrink to the line they sit on rather than pushing it apart.
        "min-h-8 [&_[data-slot=avatar]]:size-5 [&_[data-slot=select-trigger]]:py-0",
        dimmed && "opacity-60",
      )}
      style={{ gridTemplateColumns: columns.template }}
    >
      <IssueTypeIcon type={type} />

      {/* ⚠️ A redacted reference carries no id and therefore no way in (TSSR-43). Shown rather than dropped:
          a list that silently omits items is a list that lies about its own count. */}
      {readable ? (
        <IssueOpener issueKey={issueKey} onOpen={onOpen} className="truncate font-mono text-xs text-muted-foreground hover:underline">
          {issueKey}
        </IssueOpener>
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
        <IssueOpener issueKey={issueKey} onOpen={onOpen} className={summaryClassName}>
          {summary}
        </IssueOpener>
      ) : (
        <span
          className="min-w-0 truncate text-xs italic text-muted-foreground"
          title="In a project you are not a member of"
        >
          in a project you cannot see
        </span>
      )}

      <span className="flex items-center justify-end gap-2">{trailing}</span>
      <span className="flex items-center justify-end">{statusSlot ?? <StatusPill status={status} />}</span>
    </li>
  )
}

/** The key and the summary open the same thing, so they are the same control drawn twice. */
function IssueOpener({
  issueKey,
  onOpen,
  className,
  children,
}: {
  issueKey: string
  onOpen?: () => void
  className?: string
  children: ReactNode
}) {
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={className}>
        {children}
      </button>
    )
  }

  return (
    <Link to={`/issues/${issueKey}`} className={className}>
      {children}
    </Link>
  )
}

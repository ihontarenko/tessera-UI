import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { BlockNotice, dataBlockPlugin } from "@/markdown"
import type { DataBlockRequest, MarkdownPlugin } from "@/markdown"
import { resolveWikiBlocks, type PageBlockView } from "@/api/blocks"
import { statusColorStyle } from "@/components/issues/issueVisuals"

/**
 * `:::issue TSSR-4`, `:::sprint TSSR`, `:::board TSSR` — a document that reads its own tracker
 * (TSSR-18).
 *
 * What makes a page worth writing inside a tracker rather than in a text file: a runbook written in
 * March still shows the right status in September, because the numbers are read when the page is opened
 * rather than typed when it was written.
 *
 * <h2>⚠️ Why the page travels through a React context</h2>
 *
 * The library resolves a document's blocks through `useBlockData(blocks, context)`, and `context` is a
 * value the *renderer* is given. `TesseraMarkdown` renders issue descriptions, comments and wiki pages
 * from the same component with `context={undefined}` — changing that would thread a page identifier
 * through every call site that has no page.
 *
 * So the page arrives the way `IssueReferenceProvider` already brings a document's issue keys: a
 * provider above the renderer, read by a hook inside the plugin. ⚠️ **Where there is no provider the
 * blocks say so** rather than spinning or vanishing — an `:::issue` typed into an issue description
 * renders a notice explaining it only resolves on a wiki page, which is true and is the kind of thing
 * somebody would otherwise file a bug about.
 *
 * <h2>⚠️ Resolution is addressed by page, and that is a boundary rather than a convenience</h2>
 *
 * The server answers a directive only when its exact line appears in that page's *stored* markdown. So
 * a block typed a moment ago and not yet saved comes back `NOT_ON_THIS_PAGE` — correctly. Preview shows
 * the notice; saving makes it resolve.
 */

interface WikiPageAddress {
  readonly projectId: string
  readonly pageId: string
}

const WikiPageContext = createContext<WikiPageAddress | null>(null)

/**
 * Names the page a document's live blocks belong to.
 *
 * Wrap the renderer for a saved wiki page. Everything else — descriptions, comments, the editor's
 * preview of an unsaved draft — deliberately renders without one.
 */
export function WikiPageBlockProvider({
  projectId,
  pageId,
  children,
}: {
  projectId: string
  pageId: string
  children: ReactNode
}) {
  const address = useMemo(() => ({ projectId, pageId }), [projectId, pageId])

  return <WikiPageContext.Provider value={address}>{children}</WikiPageContext.Provider>
}

/** The directive names this plugin claims. Kept beside the renderer that knows how to draw each one. */
const LIVE_DIRECTIVES = ["issue", "sprint", "board"] as const

/**
 * The plugin.
 *
 * ⚠️ **Built once, at module scope**, like every other data-bearing plugin in this stack — the library
 * mounts one provider per such plugin, so a list rebuilt between renders changes hook order.
 */
export function liveBlockPlugin(): MarkdownPlugin<unknown> {
  return dataBlockPlugin<unknown, PageBlockView>({
    name: "tessera-live-blocks",
    directives: [...LIVE_DIRECTIVES],
    load: useLiveBlocks,
    render: LiveBlock,
  })
}

/**
 * Resolves a document's directives in one request.
 *
 * ⚠️ **Keyed on the set of directives, not on the document.** Typing prose around a `:::issue` must not
 * re-fetch — the same bargain `promiseLoader` makes, made by hand here because the request also needs
 * the page address, which `promiseLoader` has no way to reach.
 *
 * ⚠️ A hook called from inside the library's `useBlockData`, which is itself a hook — so `useContext`
 * and `useQuery` here are ordinary and their order is stable, since the plugin list is.
 */
function useLiveBlocks(requests: readonly DataBlockRequest[]) {
  const page = useContext(WikiPageContext)

  const directives = useMemo(
    () => requests.map((request) => ({ name: request.name, argument: request.argument })),
    [requests],
  )

  const key = useMemo(
    () => directives.map((directive) => `${directive.name}:${directive.argument}`).sort(),
    [directives],
  )

  const enabled = page !== null && directives.length > 0

  const { data, isFetching } = useQuery({
    queryKey: ["wiki-blocks", page?.projectId, page?.pageId, key],
    queryFn: () => resolveWikiBlocks(page!.projectId, page!.pageId, directives),
    enabled,
    // Live means live, but not live enough to refetch while somebody scrolls past it twice.
    staleTime: 30_000,
  })

  const results = useMemo(
    () =>
      (data ?? []).map((view) => ({ name: view.name, argument: view.argument, data: view })),
    [data],
  )

  return { results, loading: isFetching, available: page !== null }
}

/**
 * One block, drawn.
 *
 * ⚠️ **Every failure is visible.** A block that disappeared would read as "nothing to report", which is
 * a lie about a document whose whole promise is that its numbers are live. Each status below says what
 * happened and what to do about it.
 */
function LiveBlock({
  block,
  data,
  status,
}: {
  block: { name: string; body: string }
  data: PageBlockView | undefined
  status: "ready" | "loading" | "unavailable"
}) {
  const directive = `:::${block.name} ${block.body}`

  if (status === "unavailable") {
    return (
      <BlockNotice badge="Not here" directive={directive}>
        live blocks resolve on a wiki page. Elsewhere the line stays as written.
      </BlockNotice>
    )
  }

  if (status === "loading" || !data) {
    return (
      <BlockNotice badge="Loading" directive={directive}>
        reading the tracker…
      </BlockNotice>
    )
  }

  if (data.status === "NOT_FOUND") {
    return (
      <BlockNotice badge="Not found" directive={directive}>
        nothing matches that, or it lives somewhere you cannot see.
      </BlockNotice>
    )
  }

  if (data.status === "UNKNOWN_DIRECTIVE") {
    return (
      <BlockNotice badge="Unknown" directive={directive}>
        this installation has nothing that answers <code>{block.name}</code>.
      </BlockNotice>
    )
  }

  if (data.status === "NOT_ON_THIS_PAGE") {
    return (
      <BlockNotice badge="Unsaved" directive={directive}>
        a block resolves once the page holding it is saved.
      </BlockNotice>
    )
  }

  if (data.issue) {
    return <IssueCard issue={data.issue} />
  }

  if (data.sprint) {
    return <SprintCard sprint={data.sprint} />
  }

  if (data.board) {
    return <BoardCard board={data.board} />
  }

  return (
    <BlockNotice badge="Empty" directive={directive}>
      resolved to nothing at all, which should not happen — worth reporting.
    </BlockNotice>
  )
}

function IssueCard({ issue }: { issue: NonNullable<PageBlockView["issue"]> }) {
  return (
    <Link
      to={`/issues/${issue.issueKey}`}
      className="my-2 flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5 no-underline transition-colors hover:bg-accent/40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`font-mono text-xs font-semibold ${issue.open ? "" : "line-through opacity-70"}`}>
          {issue.issueKey}
        </span>
        {issue.typeName && <Chip>{issue.typeName}</Chip>}
        {issue.statusName && (
          <Chip tone={issue.statusCategory} color={issue.statusColor}>
            {issue.statusName}
          </Chip>
        )}
        {issue.resolutionName && <Chip>{issue.resolutionName}</Chip>}
      </div>

      <span className="text-sm font-medium text-foreground">{issue.summary}</span>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {issue.priorityName && <span>{issue.priorityName}</span>}
        <span>{issue.assigneeName ?? "Unassigned"}</span>
        {issue.storyPoints !== null && <span>{issue.storyPoints} points</span>}
      </div>
    </Link>
  )
}

function SprintCard({ sprint }: { sprint: NonNullable<PageBlockView["sprint"]> }) {
  return (
    <div className="my-2 flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold">{sprint.projectKey}</span>
        <span className="text-sm font-medium">{sprint.name}</span>
        <Chip>{sprint.state}</Chip>
        {sprint.endDate && <span className="text-xs text-muted-foreground">ends {sprint.endDate}</span>}
      </div>

      {sprint.goal && <p className="text-sm text-muted-foreground">{sprint.goal}</p>}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {sprint.completedIssueCount} of {sprint.issueCount} issues done
        </span>
        {/* Null, not zero — a project that does not estimate has no points at all, and "0 points"
            beside eight issues reads as a team that committed to nothing. */}
        {sprint.storyPoints !== null && (
          <span>
            {sprint.completedStoryPoints ?? 0} of {sprint.storyPoints} points
          </span>
        )}
      </div>
    </div>
  )
}

function BoardCard({ board }: { board: NonNullable<PageBlockView["board"]> }) {
  return (
    <div className="my-2 rounded-lg border bg-card px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold">{board.projectKey}</span>
        <span className="text-sm font-medium">{board.projectName}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {board.columns.map((column) => (
          <div key={column.name} className="rounded-md border px-2.5 py-1.5">
            <div className="text-xs text-muted-foreground">{column.name}</div>
            <div className="text-lg font-semibold tabular-nums">{column.issueCount}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A small label.
 *
 * `tone` takes a status category, which is the one piece of vocabulary worth colouring — a reader
 * scanning a page wants to see at a glance whether the thing is finished. `color` is the status's own
 * colour where it has one (TSSR-21) and outranks the tone, so a page and a board agree about what a
 * status looks like.
 */
function Chip({ children, tone, color }: { children: ReactNode; tone?: string | null; color?: string | null }) {
  const custom = statusColorStyle(color)

  const toneClass =
    custom.className !== ""
      ? `border-transparent ${custom.className}`
      : tone === "DONE"
        ? "border-transparent bg-primary/15 text-primary"
        : tone === "IN_PROGRESS"
          ? "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
          : "text-muted-foreground"

  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${toneClass}`} style={custom.style}>
      {children}
    </span>
  )
}

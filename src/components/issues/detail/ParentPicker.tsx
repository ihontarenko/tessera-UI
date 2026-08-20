import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Search } from "lucide-react"
import { PROJECT_SPANNING_LEVEL, searchIssues, type IssueDetail } from "@/api/issues"
import { AnchoredPanel, anchorProperties, Input, useAnchorName } from "@jmouse/ui"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { cn } from "@/lib/helpers"

/**
 * Choosing an issue's parent, including one in another project (TSSR-58).
 *
 * <h2>⚠️ A search, not a longer select</h2>
 *
 * <p>The control this replaces loaded a whole project into a dropdown, which was fine because a project
 * is bounded. Since TSSR-56 a parent may live in <em>any</em> project the reader browses, and that is
 * not bounded — a select over it would load the installation to fill a list nobody scrolls. So it asks
 * the server as somebody types, through the cross-project search that already exists and already
 * confines its answer to what the caller can see.
 *
 * <h2>⚠️ It offers only what the server would accept</h2>
 *
 * <p>Strictly-higher level everywhere, and — across a project boundary — level
 * {@link PROJECT_SPANNING_LEVEL} or above. Offering an Epic from another project would be offering a
 * refusal, which is the one thing a picker must never do.
 *
 * <p>⚠️ <strong>And it is an offer, never the authority.</strong> `requireVisibleParent` asks the same
 * questions again when the write lands, and answers <em>no such issue</em> for a project the caller
 * cannot browse. Filtering here stops somebody being refused for finding out; it does not decide
 * anything.
 *
 * <h2>⚠️ Anchored, never floating-ui</h2>
 *
 * <p>Text size is applied as `zoom`, and a JavaScript positioner cannot survive it — see
 * `ui/anchored.tsx`, which is where this application paid for that once.
 *
 * <h2>⚠️ A redacted parent can be detached from here, and that is deliberate</h2>
 *
 * <p>TSSR-56 made it a read-only chip, because a redacted reference carries no `id` and the old select
 * fell back to `None` — telling somebody an issue had no parent while it had one. A search does not
 * round-trip through an id, so the chip can stay honest *and* the child can let go of a parent it
 * cannot see. It is the child's own relationship; being unable to sever it was an accident of the
 * control, never a rule.
 */
export function ParentPicker({
  issue,
  onChange,
  disabled = false,
}: {
  issue: IssueDetail
  onChange: (parentId: string | null) => void
  disabled?: boolean
}) {
  const anchorName = useAnchorName()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")

  const query = useDebouncedValue(text).trim()

  const results = useQuery({
    queryKey: ["parent-candidates", query],
    queryFn: () => searchIssues({ text: query, size: 20 }),
    // ⚠️ Only once there is something to search for. The endpoint answers an empty query with the
    // newest issues everywhere, which is a fine list and the wrong one to open a parent picker on.
    enabled: open && query.length > 0,
  })

  const level = issue.type?.hierarchyLevel ?? 0

  const candidates = useMemo(
    () =>
      (results.data?.items ?? []).filter((item) => {
        if (item.issue.id === issue.id || item.issue.type === null) {
          return false
        }

        if (item.issue.type.hierarchyLevel <= level) {
          return false
        }

        return (
          item.project.id === issue.projectId
          || item.issue.type.hierarchyLevel >= PROJECT_SPANNING_LEVEL
        )
      }),
    [results.data, issue.id, issue.projectId, level],
  )

  function choose(parentId: string | null) {
    onChange(parentId)
    setOpen(false)
    setText("")
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        {...anchorProperties(anchorName)}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={cn(
          "flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors",
          "hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        {issue.parent ? (
          <>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {issue.parent.issueKey}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                !issue.parent.readable && "text-muted-foreground italic",
              )}
            >
              {issue.parent.readable ? issue.parent.summary : "in a project you cannot see"}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-muted-foreground">None</span>
        )}
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </button>

      <AnchoredPanel
        anchorName={anchorName}
        open={open}
        onClose={() => setOpen(false)}
        className="w-80 p-2"
      >
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search every project you can see…"
            className="h-8 pl-8 text-sm"
          />
        </div>

        <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
          {issue.parent && (
            <li>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-accent/50"
                onClick={() => choose(null)}
              >
                None — detach from {issue.parent.issueKey}
              </button>
            </li>
          )}

          {candidates.map((item) => (
            <li key={item.issue.id}>
              <button
                type="button"
                className="flex w-full min-w-0 items-baseline gap-1.5 rounded-md px-2 py-1 text-left text-sm hover:bg-accent/50"
                onClick={() => choose(item.issue.id)}
              >
                {/* The key already names the project — `MD-1` — so a second badge repeating it would
                    be noise. What is worth saying is that this candidate is somewhere ELSE, which the
                    key alone does not tell somebody reading quickly. */}
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {item.issue.issueKey}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.issue.summary}</span>
                {item.project.id !== issue.projectId && (
                  <span className="shrink-0 text-[11px] text-muted-foreground italic">
                    {item.project.name}
                  </span>
                )}
              </button>
            </li>
          ))}

          {query.length > 0 && !results.isLoading && candidates.length === 0 && (
            <li className="px-2 py-3 text-xs text-muted-foreground">
              {/* ⚠️ Two reasons produce an empty list and they are not the same fact. Saying only "no
                  results" would leave somebody searching for a hub they can see, that simply cannot
                  hold this issue, retyping the same query. */}
              Nothing here can be this issue's parent. A parent must sit above it in the hierarchy, and
              one in another project must be a type that spans them.
            </li>
          )}

          {query.length === 0 && (
            <li className="px-2 py-3 text-xs text-muted-foreground">
              Type to search. A parent in another project has to be a type that spans them — a Hub.
            </li>
          )}
        </ul>
      </AnchoredPanel>
    </>
  )
}

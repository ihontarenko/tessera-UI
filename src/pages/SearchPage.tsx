import { useMemo } from "react"
import { NavLink, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { FolderKanban, Search, Ticket } from "lucide-react"
import { Skeleton } from "@jmouse/ui"
import { findIssues, type IssueMatch } from "@/api/issues"
import { listProjects } from "@/api/projects"
import { EmptyState } from "@/components/EmptyState"
import { Highlighted } from "@/components/Highlighted"
import { PageHeader } from "@/components/PageHeader"
import { SearchInput } from "@/components/SearchInput"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

/**
 * Finding an issue by what is written in it (TSSR-156).
 *
 * ⚠️ **This is not the Issues screen, and the two must not converge.** `/issues` is a filtered table:
 * pick a project, a status, an assignee, a sort column, page through it. This answers the other
 * question — *where did we write that down* — where the reader has chosen nothing and wants to be
 * handed the right ticket. Ranked, cut to a limit, and **it reads the comments**, which is where this
 * tracker's conventions put half of what a ticket knows.
 *
 * ⚠️ **The query lives in the URL.** A search is then a link, survives a reload, and the browser's back
 * button walks out of the search rather than out of the screen. `?query=` and `?project=` are the whole
 * of this screen's state.
 *
 * ⚠️ **The server decides what is searchable.** The query runs only over the projects this member may
 * browse, resolved before either query rather than filtered afterwards — so this screen never filters a
 * result set, including the project filter, which is sent rather than applied here.
 */
export function SearchPage() {
  const [parameters, setParameters] = useSearchParams()

  const query = parameters.get("query") ?? ""
  const project = parameters.get("project") ?? ""

  const debouncedQuery = useDebouncedValue(query, 250)
  const searching = debouncedQuery.trim().length > 0

  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects })

  const results = useQuery({
    queryKey: ["issue-find", debouncedQuery, project],
    queryFn: () => findIssues(debouncedQuery, project || null),
    // ⚠️ An empty query is not sent. The server answers it with nothing anyway — a box that lists the
    // tracker when it is cleared is a screen nobody asked for — so the round trip would buy an empty
    // array at the cost of one request per deleted character.
    enabled: searching,
  })

  const matches = results.data ?? []

  /** The words to mark, taken from the query the results actually came back for. */
  const terms = useMemo(
    () => debouncedQuery.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [debouncedQuery],
  )

  /**
   * Results in their ranked order, gathered under the project each came from.
   *
   * ⚠️ **The order within a group is the server's ranking, and so is the order of the groups** — the
   * first group holds the best hit. Sorting the projects alphabetically here would throw away the only
   * thing this screen is really being given.
   */
  const grouped = useMemo(() => groupByProject(matches), [matches])

  const setParameter = (name: string, value: string) => {
    const next = new URLSearchParams(parameters)

    if (value) {
      next.set(name, value)
    } else {
      next.delete(name)
    }

    // ⚠️ Replace rather than push. Every keystroke is a state change, and pushing each one fills the
    // history with half-typed queries the back button has to be pressed through.
    setParameters(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Search"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={(value: string) => setParameter("query", value)}
              placeholder="Search issues…"
              className="w-72 max-w-full"
            />
            <label className="sr-only" htmlFor="search-project">
              Search within
            </label>
            {/* ⚠️ `bg-background` is named rather than inherited: a native select paints its own popup
                from its own background, so a transparent one draws a white list on a dark theme. */}
            <select
              id="search-project"
              value={project}
              onChange={(event) => setParameter("project", event.target.value)}
              className="h-9 max-w-56 border bg-background px-2 text-[13px] text-foreground"
            >
              <option value="">Every project</option>
              {(projects.data ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {`${entry.key} · ${entry.name}`}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {!searching ? (
        <EmptyState
          icon={Search}
          title="Search the tracker"
          message="Type to look through summaries, descriptions and comments across every project you can browse. Several words means all of them — they do not have to be next to each other."
        />
      ) : results.isLoading ? (
        <div className="space-y-2 p-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : matches.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Nothing matched"
          message="No issue you can browse carries all of those words in its key, summary, description or comments. An archived issue is not searched here — the Issues screen has a switch for those."
        />
      ) : (
        <div>
          {/* ⚠️ The count is not decoration: it is what says whether a short list is the whole truth or
              the top of a long one, and whether the project filter is the reason. */}
          <p className="border-b px-6 py-2 text-xs text-muted-foreground">
            {`${matches.length} ${matches.length === 1 ? "issue" : "issues"} · ${grouped.length} ${
              grouped.length === 1 ? "project" : "projects"
            }`}
            {project && (
              <>
                {" · "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => setParameter("project", "")}
                >
                  search everywhere instead
                </button>
              </>
            )}
          </p>

          {grouped.map((group) => (
            <section key={group.project.id}>
              <h2 className="flex items-center gap-1.5 bg-muted/40 px-6 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <FolderKanban className="size-3.5" aria-hidden="true" />
                {`${group.project.key} · ${group.project.name}`}
              </h2>

              <ul className="divide-y">
                {group.matches.map((match) => (
                  <li key={match.issue.id}>
                    <NavLink
                      to={`/issues/${match.issue.issueKey}`}
                      className="block px-6 py-3 hover:bg-accent"
                      /* ⚠️ The reckoning, on the element rather than on screen. It is the one thing that
                         makes a ranking arguable, and a row cluttered with arithmetic is a worse row —
                         so it is a title, where somebody looking for it will find it. */
                      title={match.why}
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          <Highlighted text={match.issue.issueKey} terms={terms} />
                        </span>
                        <span className="text-sm font-medium">
                          <Highlighted text={match.issue.summary} terms={terms} />
                        </span>
                        {match.issue.status && (
                          <span className="text-[11px] text-muted-foreground">
                            {match.issue.status.name}
                          </span>
                        )}
                      </div>

                      {/* ⚠️ The passages that matched — out of the description or, when the words are
                          only there, out of the comment thread. This is the difference between a list
                          somebody chooses from and one they read their way through. */}
                      {match.snippets.map((snippet, index) => (
                        <p
                          key={index}
                          className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground"
                        >
                          <Highlighted text={snippet} terms={terms} />
                        </p>
                      ))}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

/** The matches gathered by project, both the groups and their contents in the server's ranked order. */
function groupByProject(matches: IssueMatch[]) {
  const groups: Array<{ project: IssueMatch["project"]; matches: IssueMatch[] }> = []

  for (const match of matches) {
    const existing = groups.find((group) => group.project.id === match.project.id)

    if (existing) {
      existing.matches.push(match)
    } else {
      groups.push({ project: match.project, matches: [match] })
    }
  }

  return groups
}

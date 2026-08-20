import { Link } from "react-router-dom"
import { StatusPill } from "@/components/issues/issueVisuals"
import type { IssueReference } from "@/api/issues"

/**
 * Another issue, as much of it as the reader may see.
 *
 * ⚠️ **A redacted reference is shown, not hidden** (TSSR-43). The far side of a link can live in a
 * project the reader is not a member of, and dropping it would make a tracking hub's register silently
 * short — a list that lies with nothing to say it did. The key and the status travel; the summary and
 * the way through do not.
 *
 * ⚠️ **`shrink-0` on the key is load-bearing.** Without it the key is an ordinary shrinkable flex item,
 * so a long summary squeezes it until it breaks mid-token — `JMF-2` wrapping to `JMF-` and `2`, and the
 * row growing a second line to hold one digit. The summary is the part that should give; the key is four
 * characters and is what the row is identified by.
 *
 * ⚠️ And `flex w-full` rather than `inline-flex`: an inline flex box is sized by its content, so
 * `truncate` has no width to truncate against and the summary overflows instead of clipping.
 *
 * <h2>Two ways through, and the caller picks</h2>
 *
 * Without `onOpen` the row is a link to the issue's own page — right where the reader has room, and
 * right inside a dialog, where opening a second dialog on top of the first is not an improvement. With
 * `onOpen` it is a button that hands the id back, so a page can show the issue over what is already on
 * screen the way a board card does (TSSR-73). A redacted reference is neither: there is nowhere to go.
 */
export function IssueReferenceLink({
  issue,
  onOpen,
}: {
  issue: IssueReference
  onOpen?: (issueId: string) => void
}) {
  // ⚠️ The status travels either way, redacted or not. A status name is installation-wide configuration
  // rather than anybody's private text — and without it a tracking hub could not say how much of an
  // effort is done, which is most of what a hub is for.
  const state = issue.status && <StatusPill status={issue.status} />

  if (!issue.readable) {
    return (
      <span
        title={`${issue.issueKey} — in a project you are not a member of`}
        className="flex w-full min-w-0 items-baseline gap-1.5"
      >
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{issue.issueKey}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground italic">
          in a project you cannot see
        </span>
        {state}
      </span>
    )
  }

  const title = `${issue.issueKey} · ${issue.summary}`
  const body = (
    <>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{issue.issueKey}</span>
      <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
      {state}
    </>
  )

  if (onOpen && issue.id) {
    const issueId = issue.id

    return (
      <button
        type="button"
        title={title}
        className="flex w-full min-w-0 items-baseline gap-1.5 text-left hover:underline"
        onClick={() => onOpen(issueId)}
      >
        {body}
      </button>
    )
  }

  return (
    <Link to={`/issues/${issue.issueKey}`} title={title} className="flex w-full min-w-0 items-baseline gap-1.5 hover:underline">
      {body}
    </Link>
  )
}

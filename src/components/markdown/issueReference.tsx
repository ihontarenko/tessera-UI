import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { httpClient } from "@/api/httpClient"
import { ReferenceBadge, referenceKey, referencePlugin } from "@jmouse/markdown"
import type { MarkdownPlugin, ReferenceRenderProperties, ReferenceState, ReferenceToken } from "@jmouse/markdown"
import type { IssueTypeSummary, StatusCategory } from "@/api/issues"
import { IssueTypeIcon } from "@/components/issues/issueVisuals"

/**
 * `TES-42` in prose, and `[anything](issue:9f3a21)` written out — both drawn as a live badge.
 *
 * <h2>⚠️ Almost nothing happens in this file, and that is the point</h2>
 *
 * <p>The mechanism — parsing a destination, turning a bare key into one, batching a document's mentions,
 * declaring the schemes to the URL sanitiser, owning the `a` element, and the rule that an unresolved
 * reference reads as the words somebody typed — lives in `referencePlugin`. It used to live here, and a
 * near-identical copy of it lived in Kiwi; the halves that were identical were the subtle ones, and each
 * of them fails silently when it is slightly wrong.
 *
 * <p>What is Tessera's, and stays: which key shape is a key, who answers, and what the chip is
 * decorated with.
 *
 * <h2>Two ways to write one, and only one survives a re-key</h2>
 *
 * | Written | Means |
 * |---|---|
 * | `TES-42` | the key, autolinked in prose |
 * | `[anything](issue:TES-42)` | the same, said explicitly |
 * | `[anything](issue:9f3a21)` | the issue's **permanent id** — what the picker inserts |
 *
 * <p>⚠️ **An issue key is configuration.** A project carries a key strategy and a key pattern, so the
 * shape of `TES-42` is a row on a screen rather than a fact — and a reference stored in a description or
 * a wiki page carries whatever was written the day somebody wrote it. The permanent id is drawn once at
 * creation and changed by nothing.
 *
 * <p>⚠️ **The badge prints the key the resolver returned**, never the text between the brackets. Fixing
 * only the destination fixes half the problem: a link that still resolves while the prose beside it
 * prints a key that no longer exists is a document lying quietly.
 */

/**
 * ⚠️ **Anchored on both sides, and both anchors are assertions rather than `\b`.**
 *
 * - Ahead: `TES-42` inside `TES-421` must not match its first five characters — a word boundary after
 *   `2` would happily sit before `1`. Requiring a non-digit is what makes the shorter key stop claiming
 *   the longer one, and excluding `-` keeps it off `TES-42-1`.
 * - Behind: `\w` stops `xTES-42`, and `-` stops the `BAR-12` inside `FOO-BAR-12`.
 *
 * ⚠️ **A source string rather than a `RegExp`** — the library builds a fresh one per pass, because a
 * global regular expression carries `lastIndex` and one shared instance means a scan starting wherever
 * the last render happened to stop.
 */
const ISSUE_KEY_PATTERN = String.raw`(?<![\w-])[A-Z][A-Z0-9]{1,31}-\d+(?![\d-])`

/**
 * What the server answers for one reference.
 *
 * ⚠️ **Two identifiers, because a document asks in either form.** The answer is filed under both, so a
 * mention written as a key and one written as a permanent id find the same entry.
 */
export interface IssueReferenceSummary {
  issueKey: string
  hash: string
  summary: string
  status: string | null
  statusColor: string | null
  statusCategory: StatusCategory | null
  typeName: string | null
  typeIconKey: string | null
  open: boolean
}

/**
 * Resolves every reference in one request.
 *
 * ⚠️ **Keyed on the sorted set of references, not on the document.** Typing prose around a mention must
 * not re-fetch, and two documents mentioning the same issues share one cached answer.
 *
 * ⚠️ **A reference that resolves to nothing is not an error, and carries no refusal.** It is a typo, or
 * an issue in a project the reader may not see — and those two must be indistinguishable, because
 * telling them apart would leak the existence of the second. So no `refusals` map: the words the writer
 * chose stand, with no tooltip explaining anything.
 */
function useIssueReferences(tokens: readonly ReferenceToken[]): ReferenceState<IssueReferenceSummary> {
  const references = useMemo(
    () => [...new Set(tokens.map((token) => token.argument))].sort(),
    [tokens],
  )

  const { data, isFetching } = useQuery({
    queryKey: ["issue-references", references],
    queryFn: () =>
      httpClient
        .post<IssueReferenceSummary[]>("/issues/references", { references })
        .then((response) => response.data),
    enabled: references.length > 0,
    staleTime: 30_000,
  })

  return useMemo(() => {
    const byKey = new Map<string, IssueReferenceSummary>()

    // ⚠️ Filed under both identifiers, and under the scheme the library asks with — one issue mentioned
    // by key in one sentence and by permanent id in another is one entry found twice, never two.
    for (const issue of data ?? []) {
      byKey.set(referenceKey({ scheme: "issue", argument: issue.issueKey }), issue)
      byKey.set(referenceKey({ scheme: "issue", argument: issue.hash }), issue)
    }

    return { byKey, status: isFetching ? "loading" : "ready" }
  }, [references, data, isFetching])
}

/** One reference, drawn — the key as it stands now, its type, and its state. */
function IssueReference({ data }: ReferenceRenderProperties<IssueReferenceSummary>) {
  const type: IssueTypeSummary = {
    id: "",
    name: data.typeName ?? "Issue",
    hierarchyLevel: 0,
    iconKey: data.typeIconKey,
  }

  return (
    <ReferenceBadge
      href={`/issues/${data.issueKey}`}
      label={data.issueKey}
      icon={<IssueTypeIcon type={type} className="size-3.5"/>}
      accent={accentFor(data)}
      title={[data.summary, data.status].filter(Boolean).join(" · ")}
      struck={!data.open}
      className="issue-reference inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 align-baseline font-mono text-[0.85em] font-medium leading-none transition-colors hover:bg-accent"
      // ⚠️ Through the router, not a bare anchor — this issue is in THIS application, and a badge that
      // reloaded the page to reach a sibling screen would be the one link in the product that does.
      anchor={({ href, children, ...properties }) => (
        <Link to={href ?? "#"} {...properties}>
          {children}
        </Link>
      )}
    />
  )
}

/**
 * The dot's colour.
 *
 * ⚠️ **The stored colour as-is, and the category only as a fallback.** A pill mixes a stored hex towards
 * black or white because it has text on it; a dot does not, and mixing would only make two statuses
 * harder to tell apart — the one thing the mark is for.
 */
function accentFor(issue: IssueReferenceSummary): string | undefined {
  if (issue.statusColor) {
    return issue.statusColor
  }

  switch (issue.statusCategory) {
    case "IN_PROGRESS":
      return "var(--color-sky-500, #0ea5e9)"
    case "DONE":
      return "var(--color-emerald-500, #10b981)"
    case "TODO":
      return "var(--muted-foreground)"
    default:
      return undefined
  }
}

/**
 * The plugin: what Tessera contributes, and nothing more.
 *
 * ⚠️ **`legacySchemes` is not decoration.** `tessera-issue:` is what the old source pre-pass minted into
 * stored descriptions; dropping it would break every one of them for one saved line. It is accepted and
 * never written.
 *
 * ⚠️ **`fallback` is where an external-link decision belongs now.** `externalLinkPlugin` must still not
 * be installed beside this — it would claim `a`, and the later plugin silently wins.
 */
export function issueReferencePlugin(): MarkdownPlugin<unknown> {
  return referencePlugin<IssueReferenceSummary>({
    name: "issue-reference",
    schemes: ["issue"],
    legacySchemes: ["tessera-issue"],
    autolink: { pattern: ISSUE_KEY_PATTERN },
    useReferences: useIssueReferences,
    render: IssueReference,
    fallback: ({ children, ...properties }) => (
      <a {...properties} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  })
}

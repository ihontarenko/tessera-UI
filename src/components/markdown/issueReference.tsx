import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { httpClient } from "@/api/httpClient"
import type { MarkdownPlugin } from "@/markdown"

/**
 * `TES-42` in prose, rendered as a live link carrying the issue's status and summary.
 *
 * <h2>⚠️ The library has no prose-level batching slot, and this is the finding</h2>
 *
 * The ticket asked for this to resolve "through the plugin's `useBlockData` slot in one batched fetch
 * per document". It cannot: `useBlockData(blocks)` is called with the **claimed blocks** of a document —
 * the `:::name` and `;;;name` constructs a plugin owns — and an issue key is none of those. It is
 * ordinary prose, in the middle of a sentence, which is exactly why it is worth having.
 *
 * The `prose` slot that *does* see inline text offers `remarkPlugins`, `rehypePlugins`, `components`
 * and a `transform` — all of them pure. There is no hook among them, so a plugin claiming no block has
 * nowhere to put a fetch.
 *
 * **So the batching lives in the host, which is where the library says host concerns go.**
 * {@link IssueReferenceProvider} scans a document once, resolves every key it finds in a single
 * request, and publishes the answers; the plugin's element override reads them. The library stays
 * untouched, and a `useProseData` slot beside `useBlockData` is the change worth proposing upstream
 * rather than working around twice.
 *
 * <h2>How the key becomes a link</h2>
 *
 * `transform` rewrites a bare key into an ordinary Markdown link with a scheme nothing else uses, and
 * the `a` override renders that scheme specially. Two consequences worth stating:
 *
 * - ⚠️ **It survives a plugin that is not installed.** Without this plugin the transform never runs and
 *   `TES-42` is what it always was — text. Nothing breaks, which is the same portability rule the whole
 *   library rests on.
 * - ⚠️ **A key already inside a link is left alone.** The pattern requires the key not to be preceded by
 *   `[` or `(`, so `[see TES-42](…)` and an existing `(tessera-issue:TES-42)` are not rewritten into
 *   nonsense on a second pass.
 */

const SCHEME = "tessera-issue:"

/**
 * ⚠️ **Anchored to a word boundary on both sides, and the trailing one is a negative lookahead rather
 * than `\b`.** `TES-42` inside `TES-421` must not match its first five characters — a word boundary
 * after `2` would happily sit before `1`. Requiring a non-digit is what makes the shorter key stop
 * claiming the longer one.
 */
const ISSUE_KEY = /(^|[^[(\w-])([A-Z][A-Z0-9]{1,31}-\d+)(?![\d-])/g

export interface IssueReferenceSummary {
  issueKey: string
  summary: string
  status: string | null
  open: boolean
}

interface Resolved {
  readonly byKey: ReadonlyMap<string, IssueReferenceSummary>
  readonly loading: boolean
}

const IssueReferenceContext = createContext<Resolved>({ byKey: new Map(), loading: false })

/** Every issue key a document mentions, in the order a reader meets them and each one once. */
export function issueKeysIn(markdown: string): string[] {
  const found = new Set<string>()

  for (const match of markdown.matchAll(ISSUE_KEY)) {
    found.add(match[2])
  }

  return [...found]
}

/**
 * Resolves every key in one request and publishes the answers.
 *
 * ⚠️ **Keyed on the sorted set of keys, not on the document.** Typing prose around a mention must not
 * re-fetch, and two documents mentioning the same issues share one cached answer — which is the same
 * bargain `promiseLoader` makes for blocks, made here because blocks are not what this resolves.
 *
 * ⚠️ **A key that resolves to nothing is not an error.** It is a typo, or an issue in a project the
 * reader may not see — and those two must be indistinguishable, because telling them apart would leak
 * the existence of the second. Either way the link renders as plain text.
 */
export function IssueReferenceProvider({
  markdown,
  children,
}: {
  markdown: string
  children: ReactNode
}) {
  const keys = useMemo(() => issueKeysIn(markdown).sort(), [markdown])

  const { data, isFetching } = useQuery({
    queryKey: ["issue-references", keys],
    queryFn: () =>
      httpClient
        .post<IssueReferenceSummary[]>("/issues/references", { issueKeys: keys })
        .then((response) => response.data),
    enabled: keys.length > 0,
    staleTime: 30_000,
  })

  const value = useMemo<Resolved>(
    () => ({
      byKey: new Map((data ?? []).map((issue) => [issue.issueKey, issue])),
      loading: isFetching,
    }),
    [data, isFetching],
  )

  return <IssueReferenceContext.Provider value={value}>{children}</IssueReferenceContext.Provider>
}

/**
 * The plugin itself: a source pre-pass and one element override, and no state at all.
 *
 * Build it once at module scope — the library's first rule is that the plugin list must be stable
 * across renders.
 */
export function issueReferencePlugin(): MarkdownPlugin<unknown> {
  return {
    name: "issue-reference",
    prose: {
      transform: (markdown) =>
        markdown.replace(ISSUE_KEY, (_match, before: string, key: string) =>
          `${before}[${key}](${SCHEME}${key})`,
        ),
      components: {
        a: ({ href, children, ...rest }) => {
          if (typeof href === "string" && href.startsWith(SCHEME)) {
            return <IssueReferenceLink issueKey={href.slice(SCHEME.length)} />
          }

          // ⚠️ This is also where `externalLinkPlugin` would have gone. It claims the same `a`
          // component, so installing both means one of them silently losing — and it cannot be this
          // one. Two attributes here are the same outcome with nothing to collide.
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          )
        },
      },
    },
  }
}

/**
 * One reference.
 *
 * ⚠️ **Unresolved renders as the key and nothing else** — not as a broken link, not as an error. A
 * mention of an issue the reader cannot see should read exactly like the text somebody typed, because
 * anything else announces that the issue exists.
 */
function IssueReferenceLink({ issueKey }: { issueKey: string }) {
  const { byKey, loading } = useContext(IssueReferenceContext)
  const issue = byKey.get(issueKey)

  if (!issue) {
    return (
      <span className={loading ? "opacity-60" : undefined} title={loading ? "Looking up…" : undefined}>
        {issueKey}
      </span>
    )
  }

  return (
    <Link
      to={`/issues/${issue.issueKey}`}
      title={issue.summary}
      className="inline-flex items-baseline gap-1 rounded px-1 font-medium no-underline hover:bg-accent"
    >
      <span className={`font-mono text-[0.9em] ${issue.open ? "" : "line-through opacity-70"}`}>
        {issue.issueKey}
      </span>
      <span className="max-w-[24ch] truncate align-bottom text-[0.9em] text-muted-foreground">
        {issue.summary}
      </span>
    </Link>
  )
}

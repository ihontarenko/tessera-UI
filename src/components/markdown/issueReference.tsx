import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { findAndReplace } from "mdast-util-find-and-replace"
import type { Root } from "mdast"
import { httpClient } from "@/api/httpClient"
import type { MarkdownPlugin } from "@jmouse/markdown"

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
 * A remark plugin rewrites the key **in the parsed tree** into an ordinary link node with a scheme
 * nothing else uses, and the `a` override renders that scheme specially. Two consequences worth
 * stating:
 *
 * - ⚠️ **It survives a plugin that is not installed.** Without this plugin nothing rewrites anything
 *   and `TES-42` is what it always was — text. Nothing breaks, which is the same portability rule the
 *   whole library rests on.
 * - ⚠️ **Only text is rewritten.** Link text, link destinations, `` `inline code` `` and fenced blocks
 *   are all left exactly as written.
 *
 * <h2>⚠️ Why this is not the `transform` slot, which is what it used to be</h2>
 *
 * `transform` is a **source pre-pass**: a `String.replace` over the raw document before anything parses
 * it, which cannot tell prose from syntax. Three things were wrong with it, and the first is the one
 * that was reported:
 *
 * - **It was not idempotent.** A document already containing `[TES-42](tessera-issue:TES-42)` — which
 *   is what an agent writes, and what pasting a reference produces — had its *second* key rewritten
 *   again, because the character before it is `:` rather than the `[` the guard looked for. The result
 *   is `[TES-42](tessera-issue:[TES-42](tessera-issue:TES-42))`: a destination that resolves to no
 *   issue, so the reader gets the Markdown source printed at them.
 * - **It reached into code.** `` `TES-42` `` and a key inside a fenced block are quoted text; a pre-pass
 *   over the raw string turned both into links.
 * - **It missed a key in parentheses.** The guard excluded a preceding `(` to protect link
 *   destinations, so `(see TES-42)` in ordinary prose silently stayed text.
 *
 * A tree does not have those problems, because by the time it exists the parser has already decided
 * what is prose and what is syntax. `findAndReplace` visits **text nodes only**, so code never comes
 * near it, and `ignore` keeps it out of the two node types whose text is still part of a link.
 */

const SCHEME = "tessera-issue:"

/**
 * ⚠️ **Anchored on both sides, and both anchors are assertions rather than `\b`.**
 *
 * - Ahead: `TES-42` inside `TES-421` must not match its first five characters — a word boundary after
 *   `2` would happily sit before `1`. Requiring a non-digit is what makes the shorter key stop claiming
 *   the longer one, and excluding `-` keeps it off `TES-42-1`.
 * - Behind: `\w` stops `xTES-42`, and `-` stops the `BAR-12` inside `FOO-BAR-12`.
 *
 * ⚠️ **A pattern, and a factory — never one shared instance.** A global regular expression carries
 * `lastIndex`, `findAndReplace` advances it, and `matchAll` copies it from the regex it is handed. One
 * shared object therefore means {@link issueKeysIn} starting its scan wherever the last render's
 * rewrite happened to stop.
 */
const ISSUE_KEY_PATTERN = String.raw`(?<![\w-])[A-Z][A-Z0-9]{1,31}-\d+(?![\d-])`

function issueKeyMatcher(): RegExp {
  return new RegExp(ISSUE_KEY_PATTERN, "g")
}

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

/**
 * Every issue key a document mentions, in the order a reader meets them and each one once.
 *
 * ⚠️ **Over the raw source, deliberately.** A key inside a fenced block is not rendered as a link and
 * needs no answer, but excluding it would mean parsing the document a second time to decide — and the
 * cost of the two views disagreeing is one extra key in a batch nobody sees.
 */
export function issueKeysIn(markdown: string): string[] {
  const found = new Set<string>()

  for (const match of markdown.matchAll(issueKeyMatcher())) {
    found.add(match[0])
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
 * The tree pass: every issue key in prose becomes a link node carrying {@link SCHEME}.
 *
 * ⚠️ **`ignore` names the two node types whose children are text that is already a link.** A key in the
 * *text* of a link (`[see TES-42](…)`) must stay text, because a link inside a link is not a thing a
 * document can express — and a key in a *destination* is never visited at all, destinations not being
 * children. Between the two, running this over an already-linked document changes nothing, which is the
 * property the source pre-pass never had.
 */
function remarkIssueReferences() {
  return (tree: Root) => {
    findAndReplace(
      tree,
      [
        [
          issueKeyMatcher(),
          (issueKey: string) => ({
            type: "link" as const,
            url: `${SCHEME}${issueKey}`,
            children: [{ type: "text" as const, value: issueKey }],
          }),
        ],
      ],
      { ignore: ["link", "linkReference"] },
    )
  }
}

/**
 * The plugin itself: one tree pass and one element override, and no state at all.
 *
 * Build it once at module scope — the library's first rule is that the plugin list must be stable
 * across renders.
 */
export function issueReferencePlugin(): MarkdownPlugin<unknown> {
  return {
    name: "issue-reference",
    prose: {
      remarkPlugins: [remarkIssueReferences],
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

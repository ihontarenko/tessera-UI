import type { ResourceItem, ResourceSource } from "@jmouse/markdown"
import { searchIssues } from "@/api/issues"

/**
 * Where the editor's **Link** dialog gets issues from.
 *
 * <p>Picking one writes `[TSSR-0137](issue:0805ba)` — the durable form, carrying the permanent
 * identifier rather than the key.
 *
 * <h2>⚠️ Against this product's own search, not the cross-product contract</h2>
 *
 * <p>Kiwi asks through `/jmouse/blocks/api/suggest`, because Kiwi is a stranger here and that endpoint
 * exists so a stranger never has to know Tessera's API. Tessera is not a stranger to itself: routing its
 * own picker through the same hop would be one request longer, one contract wider, and would buy an
 * isolation it already has.
 *
 * <h2>⚠️ A description may mention an issue by bare key, and that is not wrong</h2>
 *
 * <p>A tracker autolinks its own keys, so `TSSR-4` typed into a description already draws a badge. The
 * picker writes the permanent form anyway: a description outlives a key rename exactly as a page does,
 * and the two forms render identically, so there is no reason to insert the fragile one.
 *
 * <h2>What it offers</h2>
 *
 * <p>Open work, most recently touched first, across every project the writer may browse — a picker whose
 * first page is last year's closed tickets is a picker people stop opening. Archived issues are out
 * entirely; they are put away, and quoting one is a deliberate act somebody can do by hand.
 */

const SUGGESTIONS = 10

function itemFor(issueKey: string, hash: string, summary: string, hint: string): ResourceItem {
  return {
    // ⚠️ The reference, not the row id — an id here would be an identifier of this product's leaking
    // into a list whose whole purpose is to hand over a different one.
    id: `issue:${hash}`,
    label: issueKey,
    value: `issue:${hash}`,
    hint: [summary, hint].filter(Boolean).join(" · "),
  }
}

export const issuesAnywhere: ResourceSource = {
  id: "issues",
  label: "Issue",
  emptyHint: "Nothing open matches that, in any project you can browse.",
  search: async (query) => {
    const found = await searchIssues({
      text: query.trim() === "" ? undefined : query.trim(),
      openOnly: true,
      size: SUGGESTIONS,
    })

    return found.items.map((item) =>
      itemFor(
        item.issue.issueKey,
        item.issue.hash,
        item.issue.summary,
        [item.project.key, item.issue.status?.name].filter(Boolean).join(" · "),
      ),
    )
  },
}

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Link2, Plus, X } from "lucide-react"
import { Button } from "@jmouse/ui"
import { InlineSelect } from "@/components/inline/InlineSelect"
import { IssueLinkDialog } from "@/components/issues/detail/IssueLinkDialog"
import { IssueReferenceLink } from "@/components/issues/detail/IssueReferenceLink"
import { LinkedIssueDialog } from "@/components/issues/detail/LinkedIssueDialog"
import { useIssueEditing } from "@/components/issues/detail/useIssueEditing"
import { useStoredPreference } from "@/hooks/useStoredPreference"
import { fetchLinkTypes, type IssueDetail, type IssueLinkView, type IssueReference } from "@/api/issues"
import { cn } from "@/lib/helpers"

const BLOCK_PREFERENCE_KEY = "tessera.issue.relations"

/**
 * A group of related issues under the words it reads as.
 *
 * `done` is derived rather than stored: `open` is the canonical invariant (ADR-0004) — no resolution —
 * so it means the same thing here as everywhere else, including for a redacted reference whose summary
 * was withheld but whose state was not.
 */
interface RelationGroup {
  label: string
  references: IssueReference[]
  /** The link each reference came from, where it came from one. Children have no link to retype. */
  links: IssueLinkView[] | null
  done: number
}

/**
 * The links, gathered under the words they read as (TSSR-43).
 *
 * ⚠️ **Grouped by label, not by type.** A symmetric type says the same word both ways and belongs in one
 * group; an asymmetric one reads `blocks` in one direction and `is blocked by` in the other, and those
 * are two different statements about this issue. Grouping by `linkTypeId` would file them together and
 * produce a heading that is true of only half its rows.
 *
 * Insertion order is kept rather than sorted: the response already returns outward links before inward
 * ones, which is the order somebody wrote them in.
 */
function groupLinksByType(links: IssueLinkView[]): RelationGroup[] {
  const groups = new Map<string, IssueLinkView[]>()

  for (const link of links) {
    const existing = groups.get(link.label) ?? []

    existing.push(link)
    groups.set(link.label, existing)
  }

  return [...groups].map(([label, grouped]) => ({
    label,
    references: grouped.map((link) => link.issue),
    links: grouped,
    done: grouped.filter((link) => !link.issue.open).length,
  }))
}

/**
 * ⚠️ **Children are a group beside the links, not a section beside the block.** They are the same
 * question — *what else is this issue attached to* — asked about containment rather than about a
 * lateral relationship, and two lists with the same rows in two places is two things to learn to read.
 * They carry no link, which is what says they cannot be retyped or removed here: a child is detached by
 * changing its parent, on the child.
 */
function relationGroups(issue: IssueDetail): RelationGroup[] {
  const groups: RelationGroup[] = []

  if (issue.children.length > 0) {
    groups.push({
      label: "Children",
      references: issue.children,
      links: null,
      done: issue.children.filter((child) => !child.open).length,
    })
  }

  return [...groups, ...groupLinksByType(issue.links)]
}

/**
 * Everything this issue is attached to — its children and its links — as one block in the content
 * column (TSSR-73).
 *
 * <h2>⚠️ Why it left the rail</h2>
 *
 * The rail is 290px. A link row carries an icon, the relationship, a key, a summary and a remove button,
 * which is more than fits in a column narrower than the summary it is describing — so every part of it
 * truncated, and the relationship, the one word that says what the row *means*, truncated first. Here it
 * has the width of the description, which is the width the sentence needs.
 *
 * <h2>Two arrangements, one set of parts</h2>
 *
 * On a **page** the block folds, remembers whether it is folded, and opens a related issue over what is
 * already on screen — the gesture a board card already has, and the one that does not throw away what
 * the reader was in the middle of.
 *
 * ⚠️ **In a dialog it does neither.** `IssueDetailPanel` is rendered by the quick view too, and a row
 * that opened a dialog from inside a dialog would stack one on the other; there the rows are ordinary
 * links to the issue's own page, and the block stays open because the pane it sits in was already the
 * reader asking for it.
 */
export function IssueLinksBlock({
  issue,
  canEdit,
  editing,
  variant = "page",
}: {
  issue: IssueDetail
  canEdit: boolean
  editing: ReturnType<typeof useIssueEditing>
  variant?: "page" | "quick"
}) {
  const isPage = variant === "page"
  const [preference, remember] = useStoredPreference<"open" | "closed">(BLOCK_PREFERENCE_KEY, "open")
  const [linking, setLinking] = useState(false)
  const [openedIssueId, setOpenedIssueId] = useState<string | null>(null)

  const groups = relationGroups(issue)
  const total = issue.links.length + issue.children.length
  const open = !isPage || preference === "open"

  const heading = (
    <span className="flex items-baseline gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Relations</span>
      <span className="text-[10px] tabular-nums text-muted-foreground">{total}</span>
    </span>
  )

  const body = (
    <div className="space-y-3">
      {total === 0 && (
        <p className="text-sm text-muted-foreground">Nothing linked, and no children.</p>
      )}

      {groups.map((group) => (
        <RelationGroupRows
          key={group.label}
          group={group}
          canEdit={canEdit}
          editing={editing}
          onOpen={isPage ? setOpenedIssueId : undefined}
        />
      ))}
    </div>
  )

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {/* ⚠️ The whole heading is the trigger on a page and plain text in a dialog — a control that
            cannot do anything is worse than no control, and in a dialog the block never folds.

            ⚠️ **A plain button rather than Radix's `Collapsible`.** Its trigger only toggles the root it
            is inside, and the content here is a sibling of the header rather than a child of it — the
            header carries the Link button too, which must not fold away with the rows. A `Collapsible`
            wrapping only its own trigger toggles nothing, which is exactly what it did. Everything that
            component would have contributed is these three attributes. */}
        {isPage ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`relations-${issue.id}`}
            className="flex items-center gap-1 rounded text-muted-foreground hover:text-foreground"
            onClick={() => remember(open ? "closed" : "open")}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
            {heading}
          </button>
        ) : (
          heading
        )}

        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs text-muted-foreground"
            onClick={() => setLinking(true)}
          >
            <Plus className="mr-1 size-3" />
            Link
          </Button>
        )}
      </div>

      <div id={`relations-${issue.id}`}>{open && body}</div>

      {canEdit && <IssueLinkDialog issue={issue} open={linking} onOpenChange={setLinking} />}

      {isPage && (
        <LinkedIssueDialog
          issueId={openedIssueId}
          open={openedIssueId !== null}
          onOpenChange={(next) => {
            if (!next) {
              setOpenedIssueId(null)
            }
          }}
        />
      )}
    </section>
  )
}

function RelationGroupRows({
  group,
  canEdit,
  editing,
  onOpen,
}: {
  group: RelationGroup
  canEdit: boolean
  editing: ReturnType<typeof useIssueEditing>
  onOpen?: (issueId: string) => void
}) {
  const { data: linkTypes = [] } = useQuery({
    queryKey: ["link-types"],
    queryFn: fetchLinkTypes,
    enabled: group.links !== null && canEdit,
  })

  return (
    <div className="space-y-1">
      {/* ⚠️ "12 of 20 done" is derived from what the response already carries, so a register costs no
          entity and no snapshot to keep in step. */}
      <div className="flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="truncate">{group.label}</span>
        <span className="shrink-0 tabular-nums normal-case">
          {group.done} of {group.references.length} done
        </span>
      </div>

      <ul className="space-y-1">
        {group.references.map((reference, index) => {
          const link = group.links?.[index] ?? null

          return (
            <li
              key={link?.id ?? reference.issueKey}
              className="flex items-baseline gap-2 rounded bg-muted/40 px-2 py-1.5 text-sm"
            >
              <Link2 className="size-3.5 shrink-0 self-center text-muted-foreground" />

              {/* ⚠️ The label IS the control (TSSR-40) — retyping a link in place, rather than deleting
                  and recreating it, which is what a mistyped one used to cost. It changes the type and
                  nothing else: an endpoint change would be a different link. */}
              {link && canEdit && (
                <InlineSelect
                  ariaLabel={`Link type — ${link.label} ${link.issue.issueKey}`}
                  // ⚠️ Natural width, not a fixed one. Every row in a group carries the SAME word, so
                  // they align without being told to — and a fixed width that fits `is blocked by` in
                  // the content column leaves nothing for the summary in the rail's 290px.
                  className="shrink-0 text-xs text-muted-foreground"
                  value={link.linkTypeId}
                  options={linkTypes.map((linkType) => ({
                    value: linkType.id,
                    // The same end of the label the row is already showing, so switching type does not
                    // silently flip which direction the reader thinks they are looking at.
                    label: link.direction === "OUTWARD" ? linkType.outwardLabel : linkType.inwardLabel,
                  }))}
                  onChange={(nextLinkTypeId) => {
                    if (nextLinkTypeId !== link.linkTypeId) {
                      editing.changeLinkType.mutate({ linkId: link.id, linkTypeId: nextLinkTypeId })
                    }
                  }}
                />
              )}

              {/* ⚠️ The row bounds the reference; the reference truncates inside it. Left to itself the
                  reference asks for `w-full`, which in a flex row means the remove button is pushed off
                  the end and lands on top of the status pill — visible only once the row is narrow,
                  which is exactly where it matters. */}
              <div className="min-w-0 flex-1">
                <IssueReferenceLink issue={reference} onOpen={onOpen} />
              </div>

              {link && canEdit && (
                <button
                  type="button"
                  className="shrink-0 self-center text-muted-foreground hover:text-destructive-ink"
                  onClick={() => editing.removeLink.mutate(link.id)}
                  aria-label={`Remove the ${link.label} link to ${link.issue.issueKey}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

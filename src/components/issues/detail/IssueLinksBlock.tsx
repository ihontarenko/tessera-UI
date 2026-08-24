import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link2, Plus, X } from "lucide-react"
import { Button } from "@jmouse/ui"
import { InlineSelect } from "@/components/inline/InlineSelect"
import { IssueContentSection } from "@/components/issues/detail/IssueContentSection"
import { IssueLinkDialog } from "@/components/issues/detail/IssueLinkDialog"
import { IssueReferenceLink } from "@/components/issues/detail/IssueReferenceLink"
import { LinkedIssueDialog } from "@/components/issues/detail/LinkedIssueDialog"
import { useIssueEditing } from "@/components/issues/detail/useIssueEditing"
import { useStoredPreference } from "@/hooks/useStoredPreference"
import { fetchLinkTypes, type IssueDetail, type IssueLinkView, type IssueReference } from "@/api/issues"

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
  // ⚠️ **Closed until somebody opens it**, and then open for good — the preference outlives the tab.
  // The heading says how many there are and how many are done, which is the question the block was
  // being left open to answer.
  const [preference, remember] = useStoredPreference<"open" | "closed">(BLOCK_PREFERENCE_KEY, "closed")
  const [linking, setLinking] = useState(false)
  const [openedIssueId, setOpenedIssueId] = useState<string | null>(null)

  const groups = relationGroups(issue)
  const total = issue.links.length + issue.children.length
  const done = groups.reduce((count, group) => count + group.done, 0)
  const open = !isPage || preference === "open"

  const body = (
    <div className="space-y-3">
      {total === 0 && (
        <p className="py-1 text-xs text-muted-foreground">Nothing linked, and no children.</p>
      )}

      {groups.map((group) => (
        <RelationGroupRows
          key={group.label}
          group={group}
          canEdit={canEdit}
          editing={editing}
          onOpen={isPage ? setOpenedIssueId : undefined}
          // ⚠️ One group needs no label: the section heading already says *Relations* and every row
          // carries the relationship in words. Two micro-headings stacked on each other saying almost
          // the same thing was the block reading as ragged rather than as informative.
          labelled={groups.length > 1}
        />
      ))}
    </div>
  )

  return (
    <>
      <IssueContentSection
        id={`relations-${issue.id}`}
        title="Relations"
        // ⚠️ Not a bare total. "3" says how much there is to read; "1 of 3 done" says what the reader
        // actually came to find out, and it is the same figure the groups derive their own from — so a
        // folded block answers the question the group headings used to.
        meta={total > 0 ? `${done} of ${total} done` : null}
        open={open}
        onToggle={isPage ? () => remember(open ? "closed" : "open") : undefined}
        action={
          canEdit && (
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
          )
        }
      >
        {body}
      </IssueContentSection>

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
    </>
  )
}

function RelationGroupRows({
  group,
  canEdit,
  editing,
  onOpen,
  labelled,
}: {
  group: RelationGroup
  canEdit: boolean
  editing: ReturnType<typeof useIssueEditing>
  onOpen?: (issueId: string) => void
  /** False when this is the only group — the section heading is already saying all of this. */
  labelled: boolean
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
      {labelled && (
        <div className="flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="truncate">{group.label}</span>
          <span className="shrink-0 tabular-nums normal-case">
            {group.done} of {group.references.length} done
          </span>
        </div>
      )}

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

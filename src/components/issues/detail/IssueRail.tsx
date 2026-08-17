import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Link2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { MemberChip } from "@/components/MemberChip"
import { SegmentedControl } from "@/components/SegmentedControl"
import { PriorityBadge, StatusPill } from "@/components/issues/issueVisuals"
import { StoryPointsControl } from "@/components/issues/StoryPointsSelect"
import { InlineSelect } from "@/components/inline/InlineSelect"
import { InlineTextField } from "@/components/inline/InlineTextField"
import { IssueActivityStream } from "@/components/issues/detail/IssueActivityStream"
import { IssueTransitionAction } from "@/components/issues/detail/IssueTransitionAction"
import { useIssueEditing } from "@/components/issues/detail/useIssueEditing"
import {
  fetchCatalog,
  fetchLinkTypes,
  listIssues,
  searchIssues,
  type IssueDetail,
  type IssueLinkView,
  type IssueReference,
} from "@/api/issues"
import { searchMembers } from "@/api/members"
import { memberName } from "@/lib/memberDisplay"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useEstimationScheme } from "@/hooks/useEstimationScheme"

const UNASSIGNED = "__unassigned__"
const NO_PARENT = "__none__"
const CHOOSE = "__choose__"

export interface IssuePermissions {
  canEdit: boolean
  canTransition: boolean
}

/** The three things a rail can be showing when it has to fit in a dialog. */
type RailPane = "details" | "activity" | "relations"

const PANES: Array<{ pane: RailPane; label: string }> = [
  { pane: "details", label: "Details" },
  { pane: "activity", label: "Activity" },
  { pane: "relations", label: "Relations" },
]

/**
 * The properties rail: where the issue is, who has it, and what it is attached to (ticket 07).
 *
 * Every field edits where it is read — a select commits on change, a text field on blur — so there is
 * no edit mode and no Save button anywhere on an issue. A member without `EDIT_ISSUE` reads exactly the
 * same rail with the editors replaced by their values.
 *
 * Two arrangements, one set of components. On a **page** everything is visible at once, because there
 * is room for it. In a **dialog** there is not, so the rail becomes three panes behind a segmented
 * control — which also means only one region can ever want to scroll, the thing that made the old modal
 * unusable. The panes are a display choice and hold no data of their own.
 */
export function IssueRail({
  issue,
  permissions,
  editing,
  variant = "page",
  canComment = false,
}: {
  issue: IssueDetail
  permissions: IssuePermissions
  editing: ReturnType<typeof useIssueEditing>
  variant?: "page" | "quick"
  canComment?: boolean
}) {
  const [pane, setPane] = useState<RailPane>("details")
  const isQuick = variant === "quick"

  return (
    <div className="space-y-3">
      <IssueTransitionAction
        issue={issue}
        canTransition={permissions.canTransition}
        isPending={editing.transition.isPending}
        onTransition={(move) => editing.transition.mutate(move)}
      />

      <Separator />

      {/* The one place a segmented control does fill its container: the rail is the width of the
          choice, and three panes sharing it evenly is the shape of the thing being chosen. */}
      {isQuick && (
        <SegmentedControl
          ariaLabel="Rail contents"
          segments={PANES.map((entry) => ({ value: entry.pane, label: entry.label }))}
          value={pane}
          onChange={setPane}
          fill
        />
      )}

      {(!isQuick || pane === "details") && (
        <PropertyRows issue={issue} canEdit={permissions.canEdit} editing={editing} />
      )}

      {isQuick && pane === "activity" && <IssueActivityStream issueId={issue.id} canComment={canComment} compact />}

      {(!isQuick || pane === "relations") && (
        <>
          {!isQuick && <Separator />}
          <HierarchyRows issue={issue} canEdit={permissions.canEdit} editing={editing} />
          {!isQuick && <Separator />}
          <LinkRows issue={issue} canEdit={permissions.canEdit} editing={editing} />
        </>
      )}
    </div>
  )
}

/**
 * A property is a row — label left, value right — not a labelled input stacked above its control.
 * Five stacked pairs cost 280px of height to carry five words; these cost a line each.
 */
function RailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  )
}

function PropertyRows({
  issue,
  canEdit,
  editing,
}: {
  issue: IssueDetail
  canEdit: boolean
  editing: ReturnType<typeof useIssueEditing>
}) {
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })
  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers() })
  const estimationScheme = useEstimationScheme(issue.projectId)

  return (
    <div className="space-y-1.5">
      <RailRow label="Assignee">
        {canEdit ? (
          <InlineSelect
            ariaLabel="Assignee"
            value={issue.assignee?.id ?? UNASSIGNED}
            options={[
              { value: UNASSIGNED, label: "Unassigned" },
              ...members.map((member) => ({ value: member.id, label: memberName(member) })),
            ]}
            onChange={(value) => editing.fields.mutate({ assigneeMemberId: value === UNASSIGNED ? null : value })}
          />
        ) : issue.assignee ? (
          <MemberChip member={issue.assignee} />
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        )}
      </RailRow>

      <RailRow label="Reporter">
        {issue.reporter ? <MemberChip member={issue.reporter} /> : <span className="text-muted-foreground">—</span>}
      </RailRow>

      <RailRow label="Priority">
        {canEdit ? (
          <InlineSelect
            ariaLabel="Priority"
            value={issue.priority?.id ?? ""}
            options={(catalog?.priorities ?? []).map((priority) => ({ value: priority.id, label: priority.name }))}
            onChange={(value) => editing.fields.mutate({ priorityId: value })}
          />
        ) : (
          <PriorityBadge priority={issue.priority} />
        )}
      </RailRow>

      {/* ⚠️ No row at all where the project does not estimate. An empty picker beside "Points" says
          the estimate is missing; the truth is that this project has no estimates (ADR-0019). */}
      {estimationScheme && (
        <RailRow label="Points">
          <StoryPointsControl
            scheme={estimationScheme}
            storyPoints={issue.storyPoints}
            canEdit={canEdit}
            className="h-7 w-full"
            onChange={(storyPoints) => editing.fields.mutate({ storyPoints })}
          />
        </RailRow>
      )}

      <RailRow label="Labels">
        {canEdit ? (
          <InlineTextField
            ariaLabel="Labels"
            value={issue.labels.join(", ")}
            canEdit
            placeholder="Add labels…"
            emptyText="—"
            className="h-7"
            onCommit={(next) =>
              editing.labels.mutate(next.split(",").map((label) => label.trim()).filter(Boolean))
            }
          />
        ) : issue.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </RailRow>
    </div>
  )
}

/**
 * A key that reads as a key and goes where a key should go — the issue's own page (ticket 07).
 *
 * ⚠️ <strong>`shrink-0` on the key is load-bearing.</strong> Without it the key is an ordinary
 * shrinkable flex item, so a long summary squeezes it until it breaks mid-token — `JMF-2` wrapping to
 * `JMF-` and `2`, and the row growing a second line to hold one digit. The summary is the part that
 * should give; the key is four characters and is what the row is identified by.
 *
 * ⚠️ And `flex w-full` rather than `inline-flex`: an inline flex box is sized by its content, so
 * `truncate` has no width to truncate against and the summary overflows the card instead of clipping.
 * Truncation needs a bounded parent, which is what the `w-full` and the `min-w-0` on the text give it.
 */
/**
 * Another issue, as much of it as the reader may see.
 *
 * ⚠️ **A redacted reference is shown, not hidden** (TSSR-43). The far side of a link can live in a
 * project the reader is not a member of, and dropping it would make a tracking hub's register silently
 * short — a list that lies with nothing to say it did. The key and the status travel; the summary and
 * the link through do not.
 */
function IssueRefLink({ issue }: { issue: IssueReference }) {
  // ⚠️ The status travels either way, redacted or not. A status name is installation-wide
  // configuration rather than anybody's private text — and without it a tracking hub could not say how
  // much of an effort is done, which is most of what a hub is for.
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

  return (
    <Link
      to={`/issues/${issue.issueKey}`}
      title={`${issue.issueKey} · ${issue.summary}`}
      className="flex w-full min-w-0 items-baseline gap-1.5 hover:underline"
    >
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{issue.issueKey}</span>
      <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
      {state}
    </Link>
  )
}

function HierarchyRows({
  issue,
  canEdit,
  editing,
}: {
  issue: IssueDetail
  canEdit: boolean
  editing: ReturnType<typeof useIssueEditing>
}) {
  const { data: projectIssues = [] } = useQuery({
    queryKey: ["issues", issue.projectId],
    queryFn: () => listIssues(issue.projectId),
  })
  const candidates = projectIssues.filter((row) => row.id !== issue.id)

  return (
    <div className="space-y-1.5">
      <RailRow label="Parent">
        {canEdit ? (
          <InlineSelect
            ariaLabel="Parent issue"
            value={issue.parent?.id ?? NO_PARENT}
            options={[
              { value: NO_PARENT, label: "None" },
              ...candidates.map((row) => ({ value: row.id, label: `${row.issueKey} · ${row.summary}` })),
            ]}
            onChange={(value) => editing.parent.mutate(value === NO_PARENT ? null : value)}
          />
        ) : issue.parent ? (
          <IssueRefLink issue={issue.parent} />
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </RailRow>

      {issue.children.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Children · {issue.children.length}
          </span>
          <ul className="space-y-1">
            {issue.children.map((child) => (
              <li key={child.id} className="flex min-w-0 rounded bg-muted/40 px-2 py-1 text-sm">
                <IssueRefLink issue={child} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * The links, gathered under the words they read as (TSSR-43).
 *
 * ⚠️ **Grouped by label, not by type.** A symmetric type says the same word both ways and belongs in one
 * group; an asymmetric one reads `blocks` in one direction and `is blocked by` in the other, and those
 * are two different statements about this issue. Grouping by `linkTypeId` would file them together and
 * produce a heading that is true of only half its rows.
 *
 * ⚠️ **`open` is the canonical invariant** (ADR-0004) — no resolution — so "done" here means the same
 * thing it means everywhere else, including for a redacted reference whose summary was withheld but
 * whose state was not.
 *
 * Insertion order is kept rather than sorted: the response already returns outward links before inward
 * ones, which is the order somebody wrote them in.
 */
function groupLinksByType(links: IssueLinkView[]): Array<{ label: string; links: IssueLinkView[]; done: number }> {
  const groups = new Map<string, IssueLinkView[]>()

  for (const link of links) {
    const existing = groups.get(link.label) ?? []

    existing.push(link)
    groups.set(link.label, existing)
  }

  return [...groups].map(([label, grouped]) => ({
    label,
    links: grouped,
    done: grouped.filter((link) => !link.issue.open).length,
  }))
}

function LinkRows({
  issue,
  canEdit,
  editing,
}: {
  issue: IssueDetail
  canEdit: boolean
  editing: ReturnType<typeof useIssueEditing>
}) {
  const [linkTypeId, setLinkTypeId] = useState(CHOOSE)
  const [targetIssueId, setTargetIssueId] = useState(CHOOSE)
  const [search, setSearch] = useState("")
  const { data: linkTypes = [] } = useQuery({ queryKey: ["link-types"], queryFn: fetchLinkTypes })

  // ⚠️ A SEARCH, NOT A LIST OF ONE PROJECT (TSSR-43). This asked `listIssues(issue.projectId)`, which
  // is why a cross-project link could never be made from the interface even though the service always
  // allowed one. And it is a search rather than a bigger dropdown because "every issue in every project
  // I belong to" is not a list anybody scrolls.
  const debouncedSearch = useDebouncedValue(search, 250)
  const { data: results } = useQuery({
    queryKey: ["issue-search", "link-candidates", debouncedSearch],
    queryFn: () => searchIssues({ text: debouncedSearch || undefined, size: 20 }),
  })
  const candidates = (results?.items ?? []).filter((row) => row.issue.id !== issue.id)

  const grouped = groupLinksByType(issue.links)

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Links · {issue.links.length}
      </span>

      {issue.links.length === 0 && <p className="text-sm text-muted-foreground">None</p>}

      {/* ⚠️ Grouped by label, with a count of what is finished (TSSR-43). A flat list of twenty is the
          shape that made a tracking hub unreadable — and "12 of 20 done" is derived from what the
          response already carries, so a register costs no entity and no snapshot to keep in step. */}
      {grouped.map((group) => (
        <div key={group.label} className="space-y-1 pt-0.5">
          <span className="flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="truncate">{group.label}</span>
            <span className="shrink-0 tabular-nums normal-case">
              {group.done} of {group.links.length} done
            </span>
          </span>

          <ul className="space-y-1">
            {group.links.map((link) => (
              <li key={link.id} className="flex items-baseline gap-1.5 rounded bg-muted/40 px-2 py-1 text-sm">
                <Link2 className="size-3.5 shrink-0 self-center text-muted-foreground" />

                {/* ⚠️ The label IS the control (TSSR-40) — retyping a link in place, rather than
                    deleting and recreating it, which is what a mistyped one used to cost. It changes
                    the type and nothing else: an endpoint change would be a different link. */}
                {canEdit ? (
                  <InlineSelect
                    ariaLabel={`Link type — ${link.label} ${link.issue.issueKey}`}
                    className="shrink-0 text-xs text-muted-foreground"
                    value={link.linkTypeId}
                    options={linkTypes.map((linkType) => ({
                      value: linkType.id,
                      // The same end of the label the row is already showing, so switching type does
                      // not silently flip which direction the reader thinks they are looking at.
                      label: link.direction === "OUTWARD" ? linkType.outwardLabel : linkType.inwardLabel,
                    }))}
                    onChange={(nextLinkTypeId) => {
                      if (nextLinkTypeId !== link.linkTypeId) {
                        editing.changeLinkType.mutate({ linkId: link.id, linkTypeId: nextLinkTypeId })
                      }
                    }}
                  />
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">{link.label}</span>
                )}

                <IssueRefLink issue={link.issue} />
                {canEdit && (
                  <button
                    type="button"
                    className="ml-auto shrink-0 self-center text-muted-foreground hover:text-destructive"
                    onClick={() => editing.removeLink.mutate(link.id)}
                    aria-label="Remove link"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {canEdit && (
        <div className="space-y-1.5 pt-1">
          <InlineSelect
            ariaLabel="Link type"
            className="rounded-md border"
            value={linkTypeId}
            options={[
              { value: CHOOSE, label: "Link type…" },
              ...linkTypes.map((linkType) => ({ value: linkType.id, label: linkType.outwardLabel })),
            ]}
            onChange={setLinkTypeId}
          />

          {/* ⚠️ Typing is how the target is found now, not scrolling (TSSR-43). The old dropdown listed
              one project, which is the single reason a cross-project link could not be made from here.
              The search is already cross-project and already scoped to what the member may browse. */}
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find an issue, any project…"
            className="h-7 text-xs"
          />

          <InlineSelect
            ariaLabel="Target issue"
            className="rounded-md border"
            value={targetIssueId}
            options={[
              { value: CHOOSE, label: candidates.length === 0 ? "No matches" : "Target issue…" },
              // The project key is part of the label, not a detail: a bare key from another project
              // means nothing to somebody who has fifty issues named TSSR-4 in their head.
              ...candidates.map((row) => ({
                value: row.issue.id,
                label: `${row.project.key} · ${row.issue.issueKey} · ${row.issue.summary}`,
              })),
            ]}
            onChange={setTargetIssueId}
          />

          <Button
            size="sm"
            variant="outline"
            className="h-7 w-full text-xs"
            disabled={linkTypeId === CHOOSE || targetIssueId === CHOOSE || editing.addLink.isPending}
            onClick={() =>
              editing.addLink.mutate(
                { linkTypeId, targetIssueId },
                {
                  onSuccess: () => {
                    setLinkTypeId(CHOOSE)
                    setTargetIssueId(CHOOSE)
                    setSearch("")
                  },
                },
              )
            }
          >
            Add link
          </Button>
        </div>
      )}
    </div>
  )
}

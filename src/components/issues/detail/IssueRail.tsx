import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Link2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { MemberChip } from "@/components/MemberChip"
import { SegmentedControl } from "@/components/SegmentedControl"
import { PriorityBadge, formatStoryPoints } from "@/components/issues/issueVisuals"
import { InlineSelect } from "@/components/issues/detail/InlineSelect"
import { InlineTextField } from "@/components/issues/detail/InlineTextField"
import { IssueActivityStream } from "@/components/issues/detail/IssueActivityStream"
import { IssueTransitionAction } from "@/components/issues/detail/IssueTransitionAction"
import { useIssueEditing } from "@/components/issues/detail/useIssueEditing"
import { fetchCatalog, fetchLinkTypes, listIssues, type IssueDetail, type IssueRef } from "@/api/issues"
import { searchMembers } from "@/api/members"
import { memberName } from "@/lib/memberDisplay"

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
 * An estimate is blank or a non-negative number. Anything else is typing, not an estimate, and the
 * field reverts rather than posting a `NaN` the server would store as "no estimate".
 */
function isEstimate(value: string): boolean {
  if (value.length === 0) {
    return true
  }

  const points = Number(value)

  return Number.isFinite(points) && points >= 0
}

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

      <RailRow label="Points">
        {canEdit ? (
          <InlineTextField
            ariaLabel="Story points"
            value={issue.storyPoints != null ? String(issue.storyPoints) : ""}
            canEdit
            placeholder="—"
            className="h-7 tabular-nums"
            accepts={isEstimate}
            onCommit={(next) => editing.fields.mutate({ storyPoints: next.length === 0 ? null : Number(next) })}
          />
        ) : (
          <span className="tabular-nums">{formatStoryPoints(issue.storyPoints)}</span>
        )}
      </RailRow>

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

/** A key that reads as a key and goes where a key should go — the issue's own page (ticket 07). */
function IssueRefLink({ issue }: { issue: IssueRef }) {
  return (
    <Link to={`/issues/${issue.issueKey}`} className="inline-flex min-w-0 items-baseline gap-1.5 hover:underline">
      <span className="font-mono text-xs">{issue.issueKey}</span>
      <span className="truncate">{issue.summary}</span>
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
              <li key={child.id} className="rounded bg-muted/40 px-2 py-1 text-sm">
                <IssueRefLink issue={child} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
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
  const { data: linkTypes = [] } = useQuery({ queryKey: ["link-types"], queryFn: fetchLinkTypes })
  const { data: projectIssues = [] } = useQuery({
    queryKey: ["issues", issue.projectId],
    queryFn: () => listIssues(issue.projectId),
  })
  const candidates = projectIssues.filter((row) => row.id !== issue.id)

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Links · {issue.links.length}
      </span>

      {issue.links.length === 0 && <p className="text-sm text-muted-foreground">None</p>}

      <ul className="space-y-1">
        {issue.links.map((link) => (
          <li key={link.id} className="flex items-baseline gap-1.5 rounded bg-muted/40 px-2 py-1 text-sm">
            <Link2 className="size-3.5 shrink-0 self-center text-muted-foreground" />
            <span className="shrink-0 text-xs text-muted-foreground">{link.label}</span>
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

      {canEdit && candidates.length > 0 && (
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
          <InlineSelect
            ariaLabel="Target issue"
            className="rounded-md border"
            value={targetIssueId}
            options={[
              { value: CHOOSE, label: "Target issue…" },
              ...candidates.map((row) => ({ value: row.id, label: `${row.issueKey} · ${row.summary}` })),
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

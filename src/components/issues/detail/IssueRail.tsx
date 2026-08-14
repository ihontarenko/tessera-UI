import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Link2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { MemberChip } from "@/components/MemberChip"
import { PriorityBadge, formatStoryPoints } from "@/components/issues/issueVisuals"
import { InlineTextField } from "@/components/issues/detail/InlineTextField"
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

/**
 * The properties rail: where the issue is, who has it, and what it is attached to (ticket 07).
 *
 * Every field edits where it is read — a select commits on change, a text field on blur — so there is
 * no edit mode and no Save button anywhere on an issue. A member without `EDIT_ISSUE` reads exactly the
 * same rail with the editors replaced by their values.
 *
 * `compact` is the modal's rail (ticket 11): the fields a glance needs, without the relationships that
 * want room and a page of their own to lead to. It is the same components either way — the modal is a
 * narrower arrangement of this, not a second implementation.
 */
export function IssueRail({
  issue,
  permissions,
  editing,
  compact = false,
}: {
  issue: IssueDetail
  permissions: IssuePermissions
  editing: ReturnType<typeof useIssueEditing>
  compact?: boolean
}) {
  const { canEdit } = permissions
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })
  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers() })

  return (
    <div className="space-y-4">
      <IssueTransitionAction
        issue={issue}
        canTransition={permissions.canTransition}
        isPending={editing.transition.isPending}
        onTransition={(move) => editing.transition.mutate(move)}
      />

      <Separator />

      <RailRow label="Assignee">
        {canEdit ? (
          <Select
            value={issue.assignee?.id ?? UNASSIGNED}
            onValueChange={(value) =>
              editing.fields.mutate({ assigneeMemberId: value === UNASSIGNED ? null : value })
            }
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {memberName(member)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : issue.assignee ? (
          <MemberChip member={issue.assignee} />
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        )}
      </RailRow>

      <RailRow label="Priority">
        {canEdit ? (
          <Select value={issue.priority?.id ?? ""} onValueChange={(value) => editing.fields.mutate({ priorityId: value })}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catalog?.priorities.map((priority) => (
                <SelectItem key={priority.id} value={priority.id}>
                  {priority.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <PriorityBadge priority={issue.priority} />
        )}
      </RailRow>

      <RailRow label="Story points">
        {canEdit ? (
          <InlineTextField
            ariaLabel="Story points"
            value={issue.storyPoints != null ? String(issue.storyPoints) : ""}
            canEdit
            placeholder="—"
            className="h-8"
            onCommit={(next) => {
              const points = next.length === 0 ? null : Number(next)
              if (points !== null && !Number.isFinite(points)) {
                return
              }
              editing.fields.mutate({ storyPoints: points })
            }}
          />
        ) : (
          formatStoryPoints(issue.storyPoints)
        )}
      </RailRow>

      <RailRow label="Reporter">
        {issue.reporter ? <MemberChip member={issue.reporter} /> : <span className="text-muted-foreground">—</span>}
      </RailRow>

      <RailRow label="Labels">
        {canEdit ? (
          <InlineTextField
            ariaLabel="Labels"
            value={issue.labels.join(", ")}
            canEdit
            placeholder="Add labels…"
            className="h-8"
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

      {!compact && (
        <>
          <Separator />
          <HierarchyRows issue={issue} canEdit={canEdit} editing={editing} />
          <Separator />
          <LinkRows issue={issue} canEdit={canEdit} editing={editing} />
        </>
      )}
    </div>
  )
}

function RailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="text-sm">{children}</div>
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
    <>
      <RailRow label="Parent">
        {canEdit ? (
          <Select
            value={issue.parent?.id ?? NO_PARENT}
            onValueChange={(value) => editing.parent.mutate(value === NO_PARENT ? null : value)}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>None</SelectItem>
              {candidates.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.issueKey} · {row.summary}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : issue.parent ? (
          <IssueRefLink issue={issue.parent} />
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </RailRow>

      {issue.children.length > 0 && (
        <RailRow label="Children">
          <ul className="space-y-1">
            {issue.children.map((child) => (
              <li key={child.id}>
                <IssueRefLink issue={child} />
              </li>
            ))}
          </ul>
        </RailRow>
      )}
    </>
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
    <RailRow label="Links">
      {issue.links.length === 0 && <p className="text-muted-foreground">None</p>}

      <ul className="space-y-1">
        {issue.links.map((link) => (
          <li key={link.id} className="flex items-baseline gap-1.5">
            <Link2 className="size-3.5 shrink-0 self-center text-muted-foreground" />
            <span className="shrink-0 text-xs text-muted-foreground">{link.label}</span>
            <IssueRefLink issue={link.issue} />
            {canEdit && (
              <button
                type="button"
                className="shrink-0 self-center text-muted-foreground hover:text-destructive"
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
        <div className="mt-2 space-y-2">
          <Select value={linkTypeId} onValueChange={setLinkTypeId}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Link type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CHOOSE} disabled>
                Link type
              </SelectItem>
              {linkTypes.map((linkType) => (
                <SelectItem key={linkType.id} value={linkType.id}>
                  {linkType.outwardLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={targetIssueId} onValueChange={setTargetIssueId}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Target issue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CHOOSE} disabled>
                Target issue
              </SelectItem>
              {candidates.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.issueKey} · {row.summary}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
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
    </RailRow>
  )
}

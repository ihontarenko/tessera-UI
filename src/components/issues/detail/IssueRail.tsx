import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { UserRoundIcon } from "lucide-react"
import { Badge, Separator } from "@jmouse/ui"
import { MemberChip } from "@/components/MemberChip"
import { SegmentedControl } from "@/components/SegmentedControl"
import { PriorityBadge } from "@/components/issues/issueVisuals"
import { ScheduleBadge } from "@/components/issues/ScheduleBadge"
import { ScheduleDateControl } from "@/components/issues/detail/ScheduleDateControl"
import { StoryPointsControl } from "@/components/issues/StoryPointsSelect"
import { InlineSelect, type InlineSelectOption } from "@/components/inline/InlineSelect"
import { InlineTextField } from "@/components/inline/InlineTextField"
import { IssueActivityStream } from "@/components/issues/detail/IssueActivityStream"
import { IssueLinksBlock } from "@/components/issues/detail/IssueLinksBlock"
import { IssueReferenceLink } from "@/components/issues/detail/IssueReferenceLink"
import { IssueTransitionAction } from "@/components/issues/detail/IssueTransitionAction"
import { ParentPicker } from "@/components/issues/detail/ParentPicker"
import { useIssueEditing } from "@/components/issues/detail/useIssueEditing"
import { fetchCatalog, type IssueDetail } from "@/api/issues"
import { isAgent, searchMembers, type MemberSummary } from "@/api/members"
import { memberName } from "@/lib/memberDisplay"
import { useEstimationScheme } from "@/hooks/useEstimationScheme"

const UNASSIGNED = "__unassigned__"

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

      {/* ⚠️ **Only in a dialog.** On a page the relations live in the content column, where a link row has
          the width of the sentence it is (TSSR-73); rendering them here as well would be the same list
          twice, disagreeing the moment one of them was edited. In a dialog there is no content column to
          put them in, so the pane is where they are. */}
      {isQuick && pane === "relations" && (
        <IssueLinksBlock issue={issue} canEdit={permissions.canEdit} editing={editing} variant="quick" />
      )}
    </div>
  )
}

/**
 * A property is a row — label left, value right — not a labelled input stacked above its control.
 * Five stacked pairs cost 280px of height to carry five words; these cost a line each.
 */
function RailRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  )
}

/**
 * A value nobody may edit, indented onto the same left edge as the ones they may.
 *
 * ⚠️ **The padding is not decoration, it is the column.** An inline control wears `px-2` so its hover
 * border has somewhere to be drawn; a plain value wearing nothing starts eight pixels further left, and
 * a rail mixing the two reads as two ragged columns rather than one — which is exactly how the reporter
 * sat beside the assignee.
 */
function RailValue({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 px-2">{children}</div>
}

/**
 * Who the assignee may be set to — the directory, plus whoever currently holds it.
 *
 * <h2>⚠️ The directory is people only, and the assignee need not be a person</h2>
 *
 * `GET /api/members` answers with `MemberKind.PERSON` and nothing else, deliberately (TSSR-33): an agent
 * is a member so that authorship has one face, not so that it can be invited. But an agent *can* hold an
 * issue — it takes its own work through `issues_assign` (TSSR-74) — so the control was being handed a
 * value that was in none of its options, and a select with an unmatched value renders **empty**. An issue
 * held by a client read as unassigned, which is the worst way for this to fail: it looks like a fact
 * rather than like a bug.
 *
 * ⚠️ **The extra option is derived from the current assignee, which is what makes it safe to offer.** It
 * exists exactly when it is already selected, so it disappears the moment somebody picks somebody else —
 * and it can therefore never be *chosen*, only displayed. That matters, because the server would refuse
 * the choice: `IssueService.resolveAssignee` lets an agent be assigned only by itself, so a person
 * handing work to a client is a `403` by design. A person may still take it *off* one, which this keeps
 * possible.
 *
 * Retired clients and people who have left the directory fall out of the same rule, for the same reason.
 */
function assigneeChoices(assignee: IssueDetail["assignee"], members: MemberSummary[]): InlineSelectOption[] {
  const choices: InlineSelectOption[] = [UNASSIGNED_CHOICE, ...members.map(memberChoice)]

  if (assignee && !members.some((member) => member.id === assignee.id)) {
    choices.splice(1, 0, memberChoice(assignee))
  }

  return choices
}

/**
 * A member, drawn the way a member is drawn everywhere else: a face beside a name.
 *
 * ⚠️ **A `MemberChip`, not an avatar assembled here.** Who holds an issue and who reported it sit two
 * rows apart in the same rail, and the reporter has always been a chip — a name on its own beside a face
 * read as two different kinds of thing rather than as the same person seen twice.
 */
function memberChoice(member: MemberSummary): InlineSelectOption {
  return {
    value: member.id,
    label: assigneeLabel(member),
    content: <MemberChip member={member} note={agentNote(member)} />,
  }
}

/**
 * The empty seat: a chip with a drawn-on face rather than a word on its own.
 *
 * It keeps the shape and the height of a member, which is the point — the row does not jump when
 * somebody is picked, and "nobody holds this" reads as an answer to the same question the faces answer.
 */
function UnassignedChip() {
  return (
    <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-current/50">
        <UserRoundIcon className="size-3.5" />
      </span>
      <span className="truncate text-sm">Unassigned</span>
    </div>
  )
}

const UNASSIGNED_CHOICE: InlineSelectOption = {
  value: UNASSIGNED,
  label: "Unassigned",
  content: <UnassignedChip />,
}

/** The name, saying what it is where that is not a person — the activity stream's own wording. */
function assigneeLabel(assignee: MemberSummary): string {
  const note = agentNote(assignee)

  if (!note) {
    return memberName(assignee)
  }

  return `${memberName(assignee)} — ${note}`
}

/** What an agent is, where it is one; nothing at all for a person. */
function agentNote(member: MemberSummary): string | null {
  if (!isAgent(member)) {
    return null
  }

  return member.retired ? "client, retired" : "client"
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
  const assigneeOptions = assigneeChoices(issue.assignee, members)

  return (
    <div className="space-y-1.5">
      <RailRow label="Assignee">
        {canEdit ? (
          <InlineSelect
            ariaLabel="Assignee"
            value={issue.assignee?.id ?? UNASSIGNED}
            options={assigneeOptions}
            onChange={(value) => editing.fields.mutate({ assigneeMemberId: value === UNASSIGNED ? null : value })}
          />
        ) : (
          <RailValue>
            {issue.assignee ? (
              <MemberChip member={issue.assignee} note={agentNote(issue.assignee)} />
            ) : (
              <UnassignedChip />
            )}
          </RailValue>
        )}
      </RailRow>

      {/* ⚠️ The parent stays a property while the children became relations (TSSR-73), and that is not an
          inconsistency: this is the one field that says where the issue *belongs*, it is edited here, and
          it is one value rather than a list. The children are a list of other issues, which is what the
          relations block is.

          ⚠️ A search rather than a select (TSSR-58). A parent may live in any project the reader browses,
          which is not a list that fits in a dropdown — and the select it replaces could not represent a
          redacted parent at all, because such a reference carries no `id` and the control fell back to
          `None`, detaching it on the next unrelated edit. */}
      <RailRow label="Parent">
        {canEdit ? (
          <ParentPicker issue={issue} onChange={(parentId) => editing.parent.mutate(parentId)} />
        ) : (
          <RailValue>
            {issue.parent ? (
              <IssueReferenceLink issue={issue.parent} />
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </RailValue>
        )}
      </RailRow>

      {/* ⚠️ A disabled picker rather than a plain chip, and the reason is the column rather than the
          field. Nobody edits a reporter — not this reader, not an administrator — so there is no
          permission being expressed here. What there is, is a row that has to line up with the pickers
          above and below it: same shell, same padding, same height, one left edge. */}
      <RailRow label="Reporter">
        {issue.reporter ? (
          <InlineSelect
            ariaLabel="Reporter"
            value={issue.reporter.id}
            options={[memberChoice(issue.reporter)]}
            disabled
          />
        ) : (
          <RailValue>
            <span className="text-muted-foreground">—</span>
          </RailValue>
        )}
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
          <RailValue>
            <PriorityBadge priority={issue.priority} />
          </RailValue>
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

      {/* ⚠️ The badge sits on the label rather than beside a fourth row, because it is not a fourth
          fact — it is the verdict on the three below it. A row of its own would read as another date
          somebody could set, and it is the only thing here nobody can. */}
      <RailRow
        label={
          <span className="flex items-center gap-1.5">
            When
            <ScheduleBadge schedule={issue.schedule} compact />
          </span>
        }
      >
        <ScheduleDateControl
          ariaLabel="Queued for"
          value={issue.schedule.queuedFor}
          canEdit={canEdit}
          quick={[
            { label: "Today", days: 0 },
            { label: "Tomorrow", days: 1 },
          ]}
          onChange={(queuedFor) => editing.schedule.mutate({ queuedFor })}
        />
      </RailRow>

      <RailRow label="Red line">
        <ScheduleDateControl
          ariaLabel="Red line"
          value={issue.schedule.redLine}
          canEdit={canEdit}
          onChange={(redLine) => editing.schedule.mutate({ redLine })}
        />
      </RailRow>

      <RailRow label="Deadline">
        <ScheduleDateControl
          ariaLabel="Deadline"
          value={issue.schedule.deadline}
          canEdit={canEdit}
          onChange={(deadline) => editing.schedule.mutate({ deadline })}
        />
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

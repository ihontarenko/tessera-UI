import { IssueTypeLabel } from "@/components/issues/issueVisuals"
import { InlineTextField } from "@/components/inline/InlineTextField"
import { IssueActivityStream } from "@/components/issues/detail/IssueActivityStream"
import { IssueRail } from "@/components/issues/detail/IssueRail"
import { useIssueEditing } from "@/components/issues/detail/useIssueEditing"
import type { IssueDetail } from "@/api/issues"
import { ADD_COMMENT, EDIT_ISSUE, TRANSITION_ISSUE } from "@/api/permissions"

/**
 * An issue, laid out as a document: what it is on the left, what is true about it on the right
 * (ticket 07). Both columns edit in place — there is no Edit button on an issue anywhere in Tessera.
 *
 * `variant` decides the arrangement, not the parts. The **page** shows everything at once: the rail
 * carries the properties and the relationships, and the activity stream runs beneath the description
 * where there is width for it. The **quick view** is the same components inside a dialog, where there
 * is not: the rail becomes three panes behind a segmented control, so only one region can want to
 * scroll and the description keeps its room.
 *
 * The rail's width is a fixed basis and the content takes the remainder. That is the whole fix for the
 * layout that shipped: a rail set to `w-full` and `shrink-0` claims the full width and refuses to give
 * any of it back, which crushed the content column to a strip.
 */
export function IssueDetailPanel({
  issue,
  permissions,
  variant = "page",
}: {
  issue: IssueDetail
  permissions: string[]
  variant?: "page" | "quick"
}) {
  const editing = useIssueEditing(issue)
  const canEdit = permissions.includes(EDIT_ISSUE)
  const canComment = permissions.includes(ADD_COMMENT)
  const isPage = variant === "page"

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-1.5">
          <IssueTypeLabel type={issue.type} />
          <InlineTextField
            ariaLabel="Summary"
            value={issue.summary}
            canEdit={canEdit}
            required
            maximumLength={255}
            className="h-auto px-2 py-1 font-display text-lg font-semibold leading-snug tracking-[-0.01em] md:text-xl"
            onCommit={(summary) => editing.fields.mutate({ summary })}
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Description</span>
          <InlineTextField
            ariaLabel="Description"
            value={issue.description ?? ""}
            canEdit={canEdit}
            multiline
            maximumLength={4000}
            placeholder="Add a description…"
            emptyText="No description."
            className="px-2 py-1.5 text-sm"
            onCommit={(description) => editing.fields.mutate({ description: description || null })}
          />
        </div>

        {isPage && <IssueActivityStream issueId={issue.id} canComment={canComment} />}
      </div>

      {/* Fixed basis, never full width: beside the content on a wide screen, folded under it on a
          narrow one, and never a reason for the content to become a strip. */}
      <aside className="w-full lg:w-[290px] lg:flex-none">
        <IssueRail
          issue={issue}
          permissions={{ canEdit, canTransition: permissions.includes(TRANSITION_ISSUE) }}
          editing={editing}
          variant={variant}
          canComment={canComment}
        />
      </aside>
    </div>
  )
}

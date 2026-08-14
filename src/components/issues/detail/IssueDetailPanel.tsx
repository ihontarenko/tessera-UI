import { IssueTypeLabel } from "@/components/issues/issueVisuals"
import { InlineTextField } from "@/components/issues/detail/InlineTextField"
import { IssueActivityStream } from "@/components/issues/detail/IssueActivityStream"
import { IssueRail } from "@/components/issues/detail/IssueRail"
import { useIssueEditing } from "@/components/issues/detail/useIssueEditing"
import type { IssueDetail } from "@/api/issues"

/**
 * An issue, laid out as a document: what it is on the left, what is true about it on the right
 * (ticket 07). Both columns edit in place — there is no Edit button on an issue anywhere in Tessera.
 *
 * `variant` is the only difference between the page and the modal (ticket 11). The page is the full
 * thing, activity stream included; the quick view is the same components with the relationships and the
 * stream left to the page, because a dialog is a glance and an issue is a document. Sharing the parts
 * rather than the layout is what keeps a field behaving identically in both.
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
  const canEdit = permissions.includes("EDIT_ISSUE")
  const isPage = variant === "page"

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-2">
          <IssueTypeLabel type={issue.type} />
          <InlineTextField
            ariaLabel="Summary"
            value={issue.summary}
            canEdit={canEdit}
            required
            maximumLength={255}
            className="px-2 py-1 font-display text-lg font-semibold tracking-[-0.01em] md:text-xl"
            onCommit={(summary) => editing.fields.mutate({ summary })}
          />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</span>
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

        {isPage && (
          <IssueActivityStream issueId={issue.id} canComment={permissions.includes("ADD_COMMENT")} />
        )}
      </div>

      {/* Beside the content on a wide screen, folded under it on a narrow one — never a second thing to
          scroll sideways to. */}
      <aside className="w-full shrink-0 lg:w-72">
        <IssueRail
          issue={issue}
          permissions={{ canEdit, canTransition: permissions.includes("TRANSITION_ISSUE") }}
          editing={editing}
          compact={!isPage}
        />
      </aside>
    </div>
  )
}

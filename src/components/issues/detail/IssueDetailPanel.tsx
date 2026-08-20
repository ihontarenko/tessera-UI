import { useState } from "react"
import { Pencil } from "lucide-react"
import { IssueTypeLabel } from "@/components/issues/issueVisuals"
import { InlineTextField } from "@/components/inline/InlineTextField"
import { MarkdownField } from "@/components/markdown/MarkdownField"
import { IssueActivityStream } from "@/components/issues/detail/IssueActivityStream"
import { IssueAttachmentsBlock } from "@/components/issues/detail/IssueAttachmentsBlock"
import { IssueLinksBlock } from "@/components/issues/detail/IssueLinksBlock"
import { IssueRail } from "@/components/issues/detail/IssueRail"
import { IssueRailAside, useIssueRailVisibility } from "@/components/issues/detail/IssueRailPanel"
import { useIssueEditing } from "@/components/issues/detail/useIssueEditing"
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut"
import { Button } from "@jmouse/ui"
import type { IssueDetail } from "@/api/issues"
import { ADD_COMMENT, EDIT_ISSUE, TRANSITION_ISSUE } from "@/api/permissions"

/**
 * An issue, laid out as a document: what it is on the left, what is true about it on the right
 * (ticket 07).
 *
 * `variant` decides the arrangement, not the parts. The **page** shows everything at once: the rail
 * carries the properties, while the relations and the activity stream run beneath the description where
 * there is width for them. The **quick view** is the same components inside a dialog, where there is
 * not: the rail becomes three panes behind a segmented control, so only one region can want to scroll
 * and the description keeps its room.
 *
 * ⚠️ **Which is why the content column owns the relations and the rail owns the parent** (TSSR-73). A
 * link row is a sentence and needs the width of one; the parent is a single field that is edited in
 * place, and it belongs with the other fields.
 *
 * The rail's width is a fixed basis and the content takes the remainder. That is the whole fix for the
 * layout that shipped: a rail set to `w-full` and `shrink-0` claims the full width and refuses to give
 * any of it back, which crushed the content column to a strip.
 *
 * <h2>⚠️ The summary edits on a click; the DESCRIPTION does not</h2>
 *
 * <p>Every other field on this screen is inline — a summary looks the same typed as it does read, so
 * clicking it is free. A description does not: it renders live blocks that somebody is meant to *use*,
 * and a click that swapped a checkbox or a diagram for its own source was the screen eating the
 * interaction it exists to offer. So the description opens from a button, or from `E`.
 *
 * <p>⚠️ **`E` is bound on the page and not in the quick view**, deliberately: the quick view is a
 * dialog, and {@link useKeyboardShortcut} refuses to fire behind one — a screen underneath a
 * conversation has no business answering keystrokes meant for it. The button is in both.
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

  const [writing, setWriting] = useState(false)
  const rail = useIssueRailVisibility()

  useKeyboardShortcut({
    key: "e",
    enabled: isPage && canEdit && !writing,
    onTrigger: () => setWriting(true),
  })

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
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Description</span>
            {canEdit && !writing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-muted-foreground"
                title={isPage ? "Edit the description — E" : "Edit the description"}
                onClick={() => setWriting(true)}
              >
                <Pencil className="mr-1 size-3" />
                Edit
                {isPage && <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px]">E</kbd>}
              </Button>
            )}
          </div>
          {/* ⚠️ Markdown, so it is shown rendered rather than as the source somebody typed. A table, a
              ;;;mermaid diagram and a TES-42 reference are the rendered thing — a field that stayed a
              textarea would mean nobody ever saw them. */}
          <MarkdownField
            value={issue.description ?? ""}
            canEdit={canEdit}
            editing={writing}
            onEditingChange={setWriting}
            openOnClick={false}
            placeholder="Add a description…"
            emptyText="No description."
            className="text-sm"
            onCommit={(description) => editing.fields.mutate({ description: description || null })}
          />
        </div>

        {/* ⚠️ Between the description and the activity, and on the PAGE only (TSSR-73). A link row is a
            sentence — "this issue blocks TSSR-40, which is done" — and a sentence needs the width of the
            description rather than the 290px of a rail. In the quick view the rail's Relations pane is
            where they are, because a dialog has no content column to give them. */}
        {/* ⚠️ Under the description and above the relations, in BOTH variants — unlike the links, which
            are page-only. An attachment is a thing the description talks about ("see the screenshot"),
            so it belongs next to it; and the quick view is where somebody triages a bug report, which is
            exactly where the screenshot has to be reachable. It is a list, so it fits a dialog. */}
        <IssueAttachmentsBlock issueId={issue.id} canEdit={canEdit} variant={variant} />

        {/* ⚠️ Between the attachments and the activity, and on the PAGE only (TSSR-73). A link row is a
            sentence — "this issue blocks TSSR-40, which is done" — and a sentence needs the width of the
            description rather than the 290px of a rail. In the quick view the rail’s Relations pane is
            where they are, because a dialog has no content column to give them. */}
        {isPage && <IssueLinksBlock issue={issue} canEdit={canEdit} editing={editing} />}

        {isPage && <IssueActivityStream issueId={issue.id} canComment={canComment} />}
      </div>

      {/* Fixed basis, never full width: beside the content on a wide screen, folded under it on a
          narrow one, folded away to a strip when somebody says so, and never a reason for the content
          to become a strip itself. */}
      {/* `min-w-0` so the rail can never be the reason the row is wider than its container: a fixed
          basis fixes the width it *asks* for, not the width its content insists on. */}
      <IssueRailAside open={rail.open} onToggle={rail.toggle}>
        <IssueRail
          issue={issue}
          permissions={{ canEdit, canTransition: permissions.includes(TRANSITION_ISSUE) }}
          editing={editing}
          variant={variant}
          canComment={canComment}
        />
      </IssueRailAside>
    </div>
  )
}

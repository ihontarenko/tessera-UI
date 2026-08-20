import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ExternalLink, Trash2 } from "lucide-react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Skeleton } from "@jmouse/ui"
import { IssueTypeIcon } from "@/components/issues/issueVisuals"
import { IssueDetailPanel } from "@/components/issues/detail/IssueDetailPanel"
import { issueQueryKey } from "@/components/issues/detail/useIssueEditing"
import { deleteIssue, getIssue } from "@/api/issues"
import { DELETE_ISSUE } from "@/api/permissions"
import { apiErrorMessage } from "@/api/errors"

interface IssueDetailModalProperties {
  issueId: string | null
  projectId: string
  permissions: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A glance at an issue without losing the board behind it (ticket 11).
 *
 * It used to be the only way to see an issue at all, which made it three tabs and an edit mode inside a
 * dialog. The issue now has a page, so this is the short version: summary, description, the transition
 * action and the fields a glance needs, with everything that wants room — the activity stream, links,
 * children — one click away on the page. It renders the page's own components in their compact
 * arrangement, so a field edited here behaves exactly as it does there.
 */
export function IssueDetailModal({ issueId, projectId, permissions, open, onOpenChange }: IssueDetailModalProperties) {
  const queryClient = useQueryClient()
  const { data: issue, isLoading } = useQuery({
    queryKey: issueQueryKey(issueId ?? ""),
    queryFn: () => getIssue(issueId as string),
    enabled: open && issueId !== null,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteIssue(issueId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["issues", projectId] })
      toast.success("Issue deleted")
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the issue")),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 768px is a one-column dialog. Two columns need room, and the rail's 290px has to come out of
          somewhere other than the description. */}
      {/* ⚠️ `grid-cols-[minmax(0,1fr)]` is load-bearing, not decoration. `DialogContent` is a GRID, and a
          grid item's automatic minimum size is its min-content width — so `max-w` caps what the dialog
          *asks* for while the column happily grows past it, and the summary, the rail and the transition
          buttons end up outside the border with a horizontal scrollbar under them. A column declared
          `minmax(0, 1fr)` is allowed to be narrower than its content, which is what lets every `min-w-0`
          inside actually take effect. */}
      <DialogContent className="grid-cols-[minmax(0,1fr)] max-h-[88vh] gap-3 overflow-y-auto sm:max-w-[900px]">
        {isLoading || !issue ? (
          <>
            <DialogHeader>
              <DialogTitle>
                <Skeleton className="h-5 w-40" />
              </DialogTitle>
            </DialogHeader>
            <Skeleton className="h-64 w-full" />
          </>
        ) : (
          <>
            {/* `pr-8` keeps the summary out from under the close button, which is positioned over the
                dialog's own padding and does not reserve room for itself. */}
            <DialogHeader className="pr-8">
              <DialogTitle className="flex min-w-0 items-center gap-2">
                <IssueTypeIcon type={issue.type} />
                <Link
                  to={`/issues/${issue.issueKey}`}
                  className="shrink-0 font-mono text-sm text-muted-foreground hover:underline"
                >
                  {issue.issueKey}
                </Link>
                <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/issues/${issue.issueKey}`}>
                  <ExternalLink className="mr-1 size-3.5" /> Open full page
                </Link>
              </Button>
              {permissions.includes(DELETE_ISSUE) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive-ink hover:text-destructive-ink"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-1 size-3.5" /> Delete
                </Button>
              )}
            </div>

            <IssueDetailPanel issue={issue} permissions={permissions} variant="quick" />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

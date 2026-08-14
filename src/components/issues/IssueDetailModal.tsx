import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ExternalLink, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
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
      <DialogContent className="max-h-[88vh] gap-3 overflow-y-auto sm:max-w-[900px]">
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
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IssueTypeIcon type={issue.type} />
                <Link to={`/issues/${issue.issueKey}`} className="font-mono text-sm text-muted-foreground hover:underline">
                  {issue.issueKey}
                </Link>
                <span className="truncate">{issue.summary}</span>
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
                  className="text-destructive hover:text-destructive"
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

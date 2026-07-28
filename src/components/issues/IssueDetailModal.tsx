import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IssueTypeIcon } from "@/components/issues/issueVisuals"
import { IssueDetailsTab } from "@/components/issues/IssueDetailsTab"
import { IssueCommentsTab } from "@/components/issues/IssueCommentsTab"
import { IssueHistoryTab } from "@/components/issues/IssueHistoryTab"
import { deleteIssue, getIssue } from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"

interface IssueDetailModalProperties {
  issueId: string | null
  projectId: string
  permissions: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The issue detail modal (ticket 07): a header with the key/type and tabs for Details, Comments and
 *  History. Controls are gated by the caller's project permissions; the backend enforces them too. */
export function IssueDetailModal({ issueId, projectId, permissions, open, onOpenChange }: IssueDetailModalProperties) {
  const queryClient = useQueryClient()
  const { data: issue, isLoading } = useQuery({
    queryKey: ["issue", issueId],
    queryFn: () => getIssue(issueId as string),
    enabled: open && issueId !== null,
  })

  const canEdit = permissions.includes("EDIT_ISSUE")
  const canTransition = permissions.includes("TRANSITION_ISSUE")
  const canComment = permissions.includes("ADD_COMMENT")
  const canDelete = permissions.includes("DELETE_ISSUE")

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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
                <span className="font-mono text-sm text-muted-foreground">{issue.issueKey}</span>
                <span className="truncate">{issue.summary}</span>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="details">
              <div className="flex items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                {canDelete && (
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

              <TabsContent value="details">
                <IssueDetailsTab issue={issue} permissions={{ canEdit, canTransition }} />
              </TabsContent>
              <TabsContent value="comments">
                <IssueCommentsTab issueId={issue.id} canComment={canComment} />
              </TabsContent>
              <TabsContent value="history">
                <IssueHistoryTab issueId={issue.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

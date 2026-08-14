import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/PageHeader"
import { IssueTypeIcon } from "@/components/issues/issueVisuals"
import { IssueDetailPanel } from "@/components/issues/detail/IssueDetailPanel"
import { issueByKeyQueryKey } from "@/components/issues/detail/useIssueEditing"
import { deleteIssue, getIssueByKey } from "@/api/issues"
import { getProject } from "@/api/projects"
import { apiErrorMessage } from "@/api/errors"

/**
 * An issue as its own page, at `/issues/{key}` (ticket 07).
 *
 * The key is the address because the key is what people paste to each other; an id in a URL is a thing
 * only the application understands. Permissions come from the issue's project rather than from whoever
 * linked here, so the page behaves the same however it was reached — a modal on a board, a link in a
 * comment, or a URL from a chat two weeks old.
 */
export function IssuePage() {
  const { issueKey = "" } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: issue, isLoading, isError } = useQuery({
    queryKey: issueByKeyQueryKey(issueKey),
    queryFn: () => getIssueByKey(issueKey),
    enabled: issueKey.length > 0,
  })

  const { data: project } = useQuery({
    queryKey: ["project", issue?.projectId],
    queryFn: () => getProject(issue?.projectId as string),
    enabled: issue != null,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteIssue(issue?.id as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["issues", issue?.projectId] })
      toast.success("Issue deleted")
      navigate(project ? `/projects/${project.id}` : "/projects")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the issue")),
  })

  if (isLoading) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-6 w-40" />} />
        <Skeleton className="h-96 w-full" />
      </>
    )
  }

  // A key that does not exist and one in a project the reader is not on are the same answer here, as
  // they are on the server: nothing is disclosed by the difference.
  if (isError || !issue) {
    return (
      <PageHeader
        title="Issue not found"
        description={`No issue ${issueKey} exists, or you are not a member of the project it belongs to.`}
      />
    )
  }

  const permissions = project?.myPermissions ?? []

  return (
    <>
      {/* The key and where it lives — not the summary, which the content column below owns and which
          is editable there. One screen saying the same sentence twice is one of them being wrong. */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <IssueTypeIcon type={issue.type} />
            <span className="font-display text-lg font-semibold tracking-[-0.02em]">{issue.issueKey}</span>
          </span>
        }
        description={
          project && (
            <Link to={`/projects/${project.id}`} className="hover:underline">
              {project.key} · {project.name}
            </Link>
          )
        }
        actions={
          permissions.includes("DELETE_ISSUE") && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-1 size-3.5" /> Delete
            </Button>
          )
        }
      />

      <div className="pt-4">
        <IssueDetailPanel issue={issue} permissions={permissions} />
      </div>
    </>
  )
}

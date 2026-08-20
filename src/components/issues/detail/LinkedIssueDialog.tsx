import { useQuery } from "@tanstack/react-query"
import { IssueDetailModal } from "@/components/issues/IssueDetailModal"
import { issueQueryKey } from "@/components/issues/detail/useIssueEditing"
import { getIssue } from "@/api/issues"
import { getProject } from "@/api/projects"

/**
 * A related issue, shown over the one being read (TSSR-73).
 *
 * <h2>⚠️ Why this exists rather than mounting the modal directly</h2>
 *
 * `IssueDetailModal` is told which project it is in and what the reader may do there, because every
 * screen that opens one — a board, a backlog, a list — is already looking at exactly one project and
 * already holds both. A **link is the one thing that crosses the boundary** (TSSR-43): the far side may
 * live in a project with an entirely different set of permissions, so passing the *current* issue's
 * would let the dialog offer edits the server will refuse, or hide ones it would have allowed.
 *
 * So the issue is read for the one fact only it knows — which project it is in — and the project is read
 * for what the reader holds there. Both are ordinary cache reads: the modal fetches the same issue under
 * the same key, so nothing is requested twice.
 *
 * ⚠️ **The permissions start empty and widen.** Until the project answers, the dialog renders read-only.
 * That is the safe direction: a control that appears a moment late is a smaller problem than one that
 * was offered and then refused.
 */
export function LinkedIssueDialog({
  issueId,
  open,
  onOpenChange,
}: {
  issueId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: issue } = useQuery({
    queryKey: issueQueryKey(issueId ?? ""),
    queryFn: () => getIssue(issueId as string),
    enabled: open && issueId !== null,
  })

  const { data: project } = useQuery({
    queryKey: ["project", issue?.projectId],
    queryFn: () => getProject(issue?.projectId as string),
    enabled: issue != null,
  })

  return (
    <IssueDetailModal
      issueId={issueId}
      projectId={issue?.projectId ?? ""}
      permissions={project?.myPermissions ?? []}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

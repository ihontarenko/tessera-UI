import { useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  addIssueLink,
  removeIssueLink,
  setIssueParent,
  transitionIssue,
  updateIssue,
  updateIssueOrganization,
  type IssueDetail,
  type UpdateIssueRequest,
} from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"

/** The cache entries an issue lives in: by id for the modal, by key for the page. */
export function issueQueryKey(issueId: string) {
  return ["issue", issueId]
}

export function issueByKeyQueryKey(issueKey: string) {
  return ["issue", "by-key", issueKey]
}

/**
 * Every write an issue surface performs, in one place.
 *
 * Two things make this a hook rather than a mutation per component. `PUT /api/issues/{id}` takes the
 * whole editable issue, and the fields now commit one at a time as they lose focus (ticket 07) — so
 * each write fills the fields it is not changing from the issue as last read, and no field can blank
 * another by omission. And an issue is cached under two keys, by id and by key, so every response is
 * written to both: editing on the page must not leave a stale copy behind the modal.
 */
export function useIssueEditing(issue: IssueDetail) {
  const queryClient = useQueryClient()

  function applyUpdated(updated: IssueDetail) {
    queryClient.setQueryData(issueQueryKey(updated.id), updated)
    queryClient.setQueryData(issueByKeyQueryKey(updated.issueKey), updated)
    // The list, the board and the backlog all render a slice of this issue, and the history gains an
    // entry for whatever just changed — none of which this response describes.
    for (const queryKey of [
      ["issues", issue.projectId],
      ["board", issue.projectId],
      ["backlog", issue.projectId],
      ["history", issue.id],
    ]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }

  function failWith(message: string) {
    return (error: unknown) => toast.error(apiErrorMessage(error, message))
  }

  const fields = useMutation({
    mutationFn: (changes: Partial<UpdateIssueRequest>) =>
      updateIssue(issue.id, {
        summary: issue.summary,
        description: issue.description,
        priorityId: issue.priority?.id ?? "",
        assigneeMemberId: issue.assignee?.id ?? null,
        storyPoints: issue.storyPoints,
        ...changes,
      }),
    onSuccess: applyUpdated,
    onError: failWith("Could not update the issue"),
  })

  const transition = useMutation({
    mutationFn: (move: { toStatusId: string; resolutionId?: string | null }) =>
      transitionIssue(issue.id, move.toStatusId, move.resolutionId),
    onSuccess: (updated) => {
      applyUpdated(updated)
      toast.success("Issue transitioned")
    },
    onError: failWith("Could not transition the issue"),
  })

  const parent = useMutation({
    mutationFn: (parentId: string | null) => setIssueParent(issue.id, parentId),
    onSuccess: applyUpdated,
    onError: failWith("Could not set the parent"),
  })

  const labels = useMutation({
    mutationFn: (values: string[]) => updateIssueOrganization(issue.id, { labels: values }),
    onSuccess: applyUpdated,
    onError: failWith("Could not update the labels"),
  })

  const addLink = useMutation({
    mutationFn: (link: { linkTypeId: string; targetIssueId: string }) =>
      addIssueLink(issue.id, link.linkTypeId, link.targetIssueId),
    onSuccess: (updated) => {
      applyUpdated(updated)
      toast.success("Link added")
    },
    onError: failWith("Could not add the link"),
  })

  const removeLink = useMutation({
    mutationFn: (linkId: string) => removeIssueLink(issue.id, linkId),
    onSuccess: applyUpdated,
    onError: failWith("Could not remove the link"),
  })

  return { fields, transition, parent, labels, addLink, removeLink }
}

import { useQueryClient, useMutation, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  changeIssueLinkType,
  removeIssueLink,
  setIssueParent,
  transitionIssue,
  updateIssue,
  updateIssueOrganization,
  updateIssueSchedule,
  type IssueDetail,
  type IssueSchedule,
  type UpdateIssueRequest,
} from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"

/** The cache entries an issue lives in: by id for the modal, by key for the page. */
export function issueQueryKey(issueId: string) {
  return ["issue", issueId]
}

/**
 * Uppercased, because the key can arrive from a hand-typed URL in any case while the server always
 * answers with the canonical one. Without this, `/issues/tes-12` would read one cache entry and every
 * edit would write another, and the page would stop updating as you edited it.
 */
export function issueByKeyQueryKey(issueKey: string) {
  return ["issue", "by-key", issueKey.toUpperCase()]
}

/**
 * Where an issue that just changed has to land: both cache entries it lives in, and every list that
 * renders a slice of it.
 *
 * Exported because archiving writes an issue from screens that never loaded one — a row on the Shipped
 * list is not an `IssueDetail` — and a second, subtly different idea of which caches an issue touches is
 * how a board goes stale after an edit made two tabs away.
 */
export function applyIssueUpdate(queryClient: QueryClient, updated: IssueDetail) {
  queryClient.setQueryData(issueQueryKey(updated.id), updated)
  queryClient.setQueryData(issueByKeyQueryKey(updated.issueKey), updated)

  for (const queryKey of [
    ["issues", updated.projectId],
    ["board", updated.projectId],
    ["backlog", updated.projectId],
    ["shipped", updated.projectId],
    ["history", updated.id],
  ]) {
    void queryClient.invalidateQueries({ queryKey })
  }
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
    // The list, the board, the backlog and the Shipped screen all render a slice of this issue, and the
    // history gains an entry for whatever just changed — none of which this response describes.
    applyIssueUpdate(queryClient, updated)
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

  /**
   * One date at a time, with the other two carried through untouched.
   *
   * ⚠️ **The route replaces all three**, so a caller sending only what it changed would clear the rest —
   * the same trap `fields` works around, and worse here because nobody moving a ticket to "today"
   * expects the deadline they agreed to disappear with it.
   */
  const schedule = useMutation({
    mutationFn: (changes: Partial<IssueSchedule>) =>
      updateIssueSchedule(issue.id, {
        queuedFor: issue.schedule.queuedFor,
        redLine: issue.schedule.redLine,
        deadline: issue.schedule.deadline,
        ...changes,
      }),
    onSuccess: applyUpdated,
    onError: failWith("Could not update the schedule"),
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

  // ⚠️ **Adding a link is deliberately not here** (TSSR-73). It was, one target at a time, because the
  // rail's picker could only offer one — and `useRegisterLinking.linkAll` already links a selection
  // sequentially, stops at the first refusal and reports how many landed. Two ways to make a link would
  // mean two behaviours on a partial failure, and only one of them is right.

  const changeLinkType = useMutation({
    mutationFn: (link: { linkId: string; linkTypeId: string }) =>
      changeIssueLinkType(issue.id, link.linkId, link.linkTypeId),
    onSuccess: applyUpdated,
    onError: failWith("Could not change the link"),
  })

  const removeLink = useMutation({
    mutationFn: (linkId: string) => removeIssueLink(issue.id, linkId),
    onSuccess: applyUpdated,
    onError: failWith("Could not remove the link"),
  })

  return { fields, transition, schedule, parent, labels, changeLinkType, removeLink }
}

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { addIssueLink, changeIssueLinkType, removeIssueLink, type IssueDetail } from "@/api/issues"
import { applyIssueUpdate } from "@/components/issues/detail/useIssueEditing"
import { apiErrorMessage } from "@/api/errors"

/** Every register list in the cache — the shape the Tracked tab reads. */
export const REGISTERS_QUERY_KEY = ["issue-registers"]

/**
 * The writes the Tracked tab performs, for a register whose hub is named per call.
 *
 * ⚠️ **Why not `useIssueEditing`.** That hook closes over one `IssueDetail` — the issue whose page or modal
 * is open — and this screen shows ten registers at once, none of them loaded as a detail. So the hub is an
 * argument here rather than a binding, and the responses still go through `applyIssueUpdate`: a link added
 * from this screen has to land in the issue's own cache entries too, or the issue page opened next shows a
 * register it does not have.
 */
export function useRegisterLinking() {
  const queryClient = useQueryClient()

  function applyAndRefresh(updated: IssueDetail) {
    applyIssueUpdate(queryClient, updated)
    void queryClient.invalidateQueries({ queryKey: REGISTERS_QUERY_KEY })
  }

  function failWith(message: string) {
    return (error: unknown) => toast.error(apiErrorMessage(error, message))
  }

  /**
   * Several issues into one register, in one gesture.
   *
   * ⚠️ **Sequential, and it stops at the first refusal.** The domain refuses a duplicate link and one that
   * would close a blocking cycle, and both answers are about the register *as it stands* — firing ten
   * requests at once would have them all decided against the same stale state. Whatever was linked before
   * the refusal stays linked, which is why the toast counts what landed rather than claiming all of it did.
   */
  const linkAll = useMutation({
    mutationFn: async (request: { hubIssueId: string; linkTypeId: string; targetIssueIds: string[] }) => {
      let updated: IssueDetail | null = null
      let linked = 0

      for (const targetIssueId of request.targetIssueIds) {
        updated = await addIssueLink(request.hubIssueId, request.linkTypeId, targetIssueId)
        linked += 1
      }

      return { updated, linked }
    },
    onSuccess: (answer) => {
      if (answer.updated) {
        applyAndRefresh(answer.updated)
      }

      toast.success(answer.linked === 1 ? "Linked" : `Linked ${answer.linked} issues`)
    },
    onError: (error, request) => {
      // A partial batch has still changed the register, so the screen must be re-read even though the
      // gesture failed — otherwise the issues that did link are invisible until a reload.
      void queryClient.invalidateQueries({ queryKey: REGISTERS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ["issue", request.hubIssueId] })
      toast.error(apiErrorMessage(error, "Could not link every issue"))
    },
  })

  const changeType = useMutation({
    mutationFn: (request: { hubIssueId: string; linkId: string; linkTypeId: string }) =>
      changeIssueLinkType(request.hubIssueId, request.linkId, request.linkTypeId),
    onSuccess: applyAndRefresh,
    onError: failWith("Could not change the link"),
  })

  const unlink = useMutation({
    mutationFn: (request: { hubIssueId: string; linkId: string }) =>
      removeIssueLink(request.hubIssueId, request.linkId),
    onSuccess: (updated) => {
      applyAndRefresh(updated)
      toast.success("Link removed")
    },
    onError: failWith("Could not remove the link"),
  })

  return { linkAll, changeType, unlink }
}

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { applyIssueUpdate } from "@/components/issues/detail/useIssueEditing"
import { archiveIssue, unarchiveIssue } from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"

/**
 * Putting an issue away, and taking it back out (TSSR-4).
 *
 * Its own hook rather than two more mutations inside `useIssueEditing`, because the surfaces differ:
 * that hook is built around an issue already loaded in full, and archiving is offered from the Shipped
 * screen, where all anybody has is a row. This takes an id.
 *
 * ⚠️ The refusal is shown rather than swallowed. Archiving open work is refused by the server with the
 * reason — resolve it first — and that sentence is the whole explanation of why the button did nothing.
 */
export function useIssueArchiving() {
  const queryClient = useQueryClient()

  const archive = useMutation({
    mutationFn: (issueId: string) => archiveIssue(issueId),
    onSuccess: (updated) => {
      applyIssueUpdate(queryClient, updated)
      toast.success(`${updated.issueKey} archived`)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not archive the issue")),
  })

  const unarchive = useMutation({
    mutationFn: (issueId: string) => unarchiveIssue(issueId),
    onSuccess: (updated) => {
      applyIssueUpdate(queryClient, updated)
      toast.success(`${updated.issueKey} restored`)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not restore the issue")),
  })

  return { archive, unarchive }
}

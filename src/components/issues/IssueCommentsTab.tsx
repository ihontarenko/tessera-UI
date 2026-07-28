import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { addComment, deleteComment, editComment, listComments, type Comment } from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString()
}

/** The Comments tab (ticket 13): a flat list; add for anyone with ADD_COMMENT, edit/delete when the
 *  server marks a comment editable (own comment, or project administrator). */
export function IssueCommentsTab({ issueId, canComment }: { issueId: string; canComment: boolean }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState("")

  const commentsKey = ["comments", issueId]
  const { data: comments, isLoading } = useQuery({ queryKey: commentsKey, queryFn: () => listComments(issueId) })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: commentsKey })

  const addMutation = useMutation({
    mutationFn: () => addComment(issueId, draft.trim()),
    onSuccess: () => {
      setDraft("")
      void invalidate()
      toast.success("Comment added")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not add the comment")),
  })

  const editMutation = useMutation({
    mutationFn: () => editComment(issueId, editingId as string, editingBody.trim()),
    onSuccess: () => {
      setEditingId(null)
      setEditingBody("")
      void invalidate()
      toast.success("Comment updated")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update the comment")),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(issueId, commentId),
    onSuccess: () => {
      void invalidate()
      toast.success("Comment deleted")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the comment")),
  })

  function startEditing(comment: Comment) {
    setEditingId(comment.id)
    setEditingBody(comment.body)
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />
  }

  return (
    <div className="space-y-4">
      {canComment && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a comment…"
            rows={3}
            maxLength={4000}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={draft.trim().length === 0 || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? "Posting…" : "Comment"}
            </Button>
          </div>
        </div>
      )}

      {comments && comments.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No comments yet" message="Start the discussion on this issue." />
      ) : (
        <ul className="space-y-4">
          {comments?.map((comment) => (
            <li key={comment.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <MemberChip member={comment.author} />
                <span className="text-xs text-muted-foreground">{formatTimestamp(comment.createdAt)}</span>
              </div>

              {editingId === comment.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={editingBody}
                    onChange={(event) => setEditingBody(event.target.value)}
                    rows={3}
                    maxLength={4000}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={editingBody.trim().length === 0 || editMutation.isPending}
                      onClick={() => editMutation.mutate()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm">{comment.body}</p>
              )}

              {comment.editable && editingId !== comment.id && (
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => startEditing(comment)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(comment.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

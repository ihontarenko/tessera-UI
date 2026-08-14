import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { MemberChip } from "@/components/MemberChip"
import {
  addComment,
  deleteComment,
  editComment,
  listComments,
  listHistory,
  type ActivityLog,
  type Comment,
} from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"
import { cn } from "@/lib/helpers"

// Stable field keys → human labels (the backend records the key; the UI localizes it — ADR-0007).
// Only fields the tracker still has are listed. History written before components and versions were
// removed (ADR-0017) falls through to the raw key rather than naming a field that no longer exists.
const FIELD_LABELS: Record<string, string> = {
  created: "Created",
  summary: "Summary",
  description: "Description",
  type: "Type",
  priority: "Priority",
  assignee: "Assignee",
  storyPoints: "Story points",
  status: "Status",
  resolution: "Resolution",
  parent: "Parent",
  labels: "Labels",
  link: "Link",
  sprint: "Sprint",
}

type StreamScope = "all" | "comments" | "changes"

const SCOPES: Array<{ scope: StreamScope; label: string }> = [
  { scope: "all", label: "All" },
  { scope: "comments", label: "Comments" },
  { scope: "changes", label: "Changes" },
]

type StreamEntry =
  | { kind: "comment"; id: string; at: string; comment: Comment }
  | { kind: "change"; id: string; at: string; event: ActivityLog }

/**
 * What happened to this issue, as one story (ticket 08).
 *
 * Comments and field changes were two tabs, which meant a comment explaining a status change sat one
 * click away from the change it explained. They are one stream now, ordered by time, with a segmented
 * control for when the history is noisy enough that only one of the two is wanted.
 *
 * The two reads stay separate — they are separate endpoints and separate caches, and merging them is a
 * sort over two arrays, not a reason for a new backend shape. Newest first, with the composer above the
 * stream, so the freshest thing and the place to answer it are both on screen without scrolling.
 */
export function IssueActivityStream({ issueId, canComment }: { issueId: string; canComment: boolean }) {
  const queryClient = useQueryClient()
  const [scope, setScope] = useState<StreamScope>("all")
  const [draft, setDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState("")

  const commentsKey = ["comments", issueId]
  const historyKey = ["history", issueId]

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: commentsKey,
    queryFn: () => listComments(issueId),
  })
  const { data: events = [], isLoading: historyLoading } = useQuery({
    queryKey: historyKey,
    queryFn: () => listHistory(issueId),
  })

  const entries = useMemo(() => mergeStream(comments, events, scope), [comments, events, scope])

  function invalidateComments() {
    void queryClient.invalidateQueries({ queryKey: commentsKey })
  }

  const addMutation = useMutation({
    mutationFn: () => addComment(issueId, draft.trim()),
    onSuccess: () => {
      setDraft("")
      invalidateComments()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not add the comment")),
  })

  const editMutation = useMutation({
    mutationFn: () => editComment(issueId, editingId as string, editingBody.trim()),
    onSuccess: () => {
      setEditingId(null)
      setEditingBody("")
      invalidateComments()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update the comment")),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(issueId, commentId),
    onSuccess: invalidateComments,
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the comment")),
  })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activity</h2>
        <div className="flex gap-1 rounded-md border p-0.5">
          {SCOPES.map((entry) => (
            <button
              key={entry.scope}
              type="button"
              onClick={() => setScope(entry.scope)}
              aria-pressed={scope === entry.scope}
              className={cn(
                "rounded px-2.5 py-1 text-xs transition-colors",
                scope === entry.scope
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

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

      {(commentsLoading || historyLoading) && <Skeleton className="h-24 w-full" />}

      {!commentsLoading && !historyLoading && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      )}

      <ol className="space-y-3">
        {entries.map((entry) =>
          entry.kind === "comment" ? (
            <li key={entry.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <MemberChip member={entry.comment.author} />
                <span className="text-xs text-muted-foreground">{formatTimestamp(entry.at)}</span>
              </div>

              {editingId === entry.comment.id ? (
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
                <p className="mt-2 whitespace-pre-wrap text-sm">{entry.comment.body}</p>
              )}

              {entry.comment.editable && editingId !== entry.comment.id && (
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(entry.comment.id)
                      setEditingBody(entry.comment.body)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(entry.comment.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ) : (
            <li key={entry.id} className="rounded-md border border-dashed p-3">
              <div className="flex items-center justify-between gap-2">
                <MemberChip member={entry.event.actor} />
                <span className="text-xs text-muted-foreground">{formatTimestamp(entry.at)}</span>
              </div>
              {/* One edit touching several fields is one event with its items — the shape the activity
                  log already records (ADR-0007), so it reads as one act rather than three. */}
              <ul className="mt-2 space-y-1">
                {entry.event.items.map((item, index) => (
                  <li key={index} className="text-sm">
                    <span className="font-medium">{FIELD_LABELS[item.field] ?? item.field}</span>{" "}
                    {item.field === "created" ? (
                      <span className="text-muted-foreground">{item.newValue}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        <span className="line-through opacity-70">{item.oldValue ?? "—"}</span>
                        {" → "}
                        <span className="text-foreground">{item.newValue ?? "—"}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ),
        )}
      </ol>
    </section>
  )
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString()
}

/** The merge itself: two lists into one, newest first, filtered by what the reader asked to see. */
function mergeStream(comments: Comment[], events: ActivityLog[], scope: StreamScope): StreamEntry[] {
  const entries: StreamEntry[] = []

  if (scope !== "changes") {
    for (const comment of comments) {
      entries.push({ kind: "comment", id: `comment-${comment.id}`, at: comment.createdAt, comment })
    }
  }

  if (scope !== "comments") {
    for (const event of events) {
      entries.push({ kind: "change", id: `change-${event.id}`, at: event.createdAt, event })
    }
  }

  // Compared as instants, not as strings: the backend serialises LocalDateTime with however many
  // fractional digits the value needs, so "…:20.5" and "…:20.45" sort the wrong way round as text.
  return entries.sort((first, second) => Date.parse(second.at) - Date.parse(first.at))
}

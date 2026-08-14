import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { MessageSquare, PencilLine } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { MemberSummary } from "@/api/members"
import { memberInitials, memberName } from "@/lib/memberDisplay"
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
export function IssueActivityStream({
  issueId,
  canComment,
  compact = false,
}: {
  issueId: string
  canComment: boolean
  /** The rail's arrangement: the same stream with the heading dropped and the composer shortened. */
  compact?: boolean
}) {
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
    <section className={cn("space-y-4", compact && "space-y-2.5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!compact && (
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activity</h2>
        )}
        {/* Sized to its three words, not to the column it happens to sit in: a control stretched the
            width of a page reads as a navigation bar rather than as a filter on the list below it. */}
        <div className="inline-flex gap-0.5 rounded-md border p-0.5">
          {SCOPES.map((entry) => (
            <button
              key={entry.scope}
              type="button"
              onClick={() => setScope(entry.scope)}
              aria-pressed={scope === entry.scope}
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
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
            rows={compact ? 2 : 3}
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

      {/* A gutter of avatars with the text beside it — not a stack of cards. A card draws a box around
          whatever is inside it, and "Test" in a box reads as an empty box; a line of text reads as a
          short remark, which is what it is. */}
      <ol className="space-y-2.5">
        {entries.map((entry) =>
          entry.kind === "comment" ? (
            <li key={entry.id} className="group grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5">
              <StreamAvatar member={entry.comment.author} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">{memberName(entry.comment.author)}</span>
                  <KindBadge kind="comment" />
                  <Timestamp at={entry.at} />
                  {entry.comment.editable && editingId !== entry.comment.id && (
                    // Present but quiet until the row is under the pointer or holds focus: two controls
                    // per comment, always drawn, is most of what made the old card so tall.
                    <span className="ml-auto flex shrink-0 gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingId(entry.comment.id)
                          setEditingBody(entry.comment.body)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(entry.comment.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>

                {editingId === entry.comment.id ? (
                  <div className="mt-1.5 space-y-2">
                    <Textarea
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                      rows={3}
                      maxLength={4000}
                      autoFocus
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
                  // Capped at a readable measure so a long comment does not run the width of a wide
                  // page, and a short one does not sit alone in a field of nothing.
                  <p className="max-w-[68ch] whitespace-pre-wrap text-sm text-foreground/90">
                    {entry.comment.body}
                  </p>
                )}
              </div>
            </li>
          ) : (
            // A field change is one line. It has no body to give it height, so giving it a box only
            // gave it emptiness — and the changes are the entries there are most of.
            <li key={entry.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5">
              <StreamAvatar member={entry.event.actor} />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{memberName(entry.event.actor)}</span>{" "}
                <KindBadge kind="change" />{" "}
                {/* One edit touching several fields is one event with its items — the shape the
                    activity log already records (ADR-0007) — so it reads as one act, on one line. */}
                {entry.event.items.map((item, index) => (
                  <span key={index}>
                    {index > 0 && <span className="text-muted-foreground/60"> · </span>}
                    <span className="text-foreground/80">{FIELD_LABELS[item.field] ?? item.field}</span>{" "}
                    {item.field === "created" ? (
                      <span>{item.newValue}</span>
                    ) : (
                      <>
                        <span className="line-through opacity-70">{item.oldValue ?? "—"}</span>
                        {" → "}
                        <span className="text-foreground/80">{item.newValue ?? "—"}</span>
                      </>
                    )}
                  </span>
                ))}
                <span className="text-muted-foreground/60"> · </span>
                <Timestamp at={entry.at} />
              </p>
            </li>
          ),
        )}
      </ol>
    </section>
  )
}

/**
 * What kind of entry this is, said rather than implied.
 *
 * The two are already shaped differently — a comment has a body, a change is one line — but that only
 * reads once you know the convention, and a one-word comment looks a great deal like a change. The
 * badge is the label the convention was standing in for.
 */
function KindBadge({ kind }: { kind: "comment" | "change" }) {
  const Icon = kind === "comment" ? MessageSquare : PencilLine

  return (
    <span
      className={cn(
        "inline-flex shrink-0 translate-y-px items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium tracking-wide uppercase",
        kind === "comment" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-2.5" />
      {kind === "comment" ? "Comment" : "Change"}
    </span>
  )
}

/** The stream's gutter: an avatar and nothing else, since the name is already on the line beside it. */
function StreamAvatar({ member }: { member: MemberSummary | null }) {
  return (
    <Avatar className="mt-0.5 size-6 shrink-0">
      <AvatarFallback className="text-[10px]">{memberInitials(member)}</AvatarFallback>
    </Avatar>
  )
}

/**
 * "2 hours ago", with the exact moment on hover. A stream is read for its order and its recency;
 * "8/13/2026, 10:44:41 PM" answers a question nobody asked and takes a third of the line to do it.
 */
function Timestamp({ at }: { at: string }) {
  const moment = new Date(at)

  return (
    <time
      dateTime={at}
      title={moment.toLocaleString()}
      className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
    >
      {formatDistanceToNow(moment, { addSuffix: true })}
    </time>
  )
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

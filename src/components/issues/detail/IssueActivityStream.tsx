import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Bot, MessageSquare, PencilLine } from "lucide-react"
import { MemberAvatar } from "@/components/MemberAvatar"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea } from "@jmouse/ui"
import { TesseraMarkdown } from "@/components/markdown/TesseraMarkdown"
import { SegmentedControl } from "@/components/SegmentedControl"
import { ISSUE_SECTION_GUTTER } from "@/components/issues/detail/IssueContentSection"
import { isAgent, type MemberSummary } from "@/api/members"
import { memberName } from "@/lib/memberDisplay"
import {
  addComment,
  deleteComment,
  editComment,
  listComments,
  listHistory,
  type ActivityLog,
  type Comment,
  type CommentTopicSummary,
} from "@/api/issues"
import { listCommentTopics, type CommentTopicResponse } from "@/api/configurationAdministration"
import { CommentTopicIcon, commentTopicStyle } from "@/components/issues/commentTopicVisuals"
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
  queuedFor: "Queued for",
  redLine: "Red line",
  deadline: "Deadline",
}

type StreamScope = "all" | "comments" | "changes"

const SCOPES: Array<{ scope: StreamScope; label: string }> = [
  { scope: "all", label: "All" },
  { scope: "comments", label: "Comments" },
  { scope: "changes", label: "Changes" },
]

type StreamEntry =
  | { kind: "comment"; id: string; at: string; comment: Comment; replies: Comment[] }
  | { kind: "change"; id: string; at: string; event: ActivityLog }

/** The DOM id a comment is linked by (TSSR-27). Prefixed: a bare UUID in a fragment reads as noise. */
export function commentAnchorId(commentId: string): string {
  return `comment-${commentId}`
}

/** The comment the current fragment points at, or null when it points at something else or nothing. */
function commentIdFromHash(): string | null {
  const fragment = window.location.hash.replace(/^#/, "")

  return fragment.startsWith("comment-") ? fragment.slice("comment-".length) : null
}

/**
 * ⚠️ Motion is what the setting is about, not colour. A reader who asked for no animation still gets the
 * highlight — they just arrive at the comment instead of being flown to it.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * "No topic", as a value a select can actually hold.
 *
 * A Radix select refuses `""` — that is how it says "nothing is chosen" internally — so the absence
 * needs a name of its own here and is turned back into `null` at the edge, in {@link topicIdOf}.
 */
const NO_TOPIC = "__none__"

function topicIdOf(value: string): string | null {
  return value === NO_TOPIC ? null : value
}

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
  const [draftTopicId, setDraftTopicId] = useState(NO_TOPIC)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState("")
  const [editingTopicId, setEditingTopicId] = useState(NO_TOPIC)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [replyTopicId, setReplyTopicId] = useState(NO_TOPIC)
  const [linkedCommentId, setLinkedCommentId] = useState<string | null>(commentIdFromHash)

  // ⚠️ The page's copy owns the anchors; the board's quick rail does not. Both can be mounted, and two
  // elements sharing a DOM id means the browser scrolls to whichever it finds first. The rail still
  // offers the copy control — a link is worth taking from anywhere — it just is not the thing linked to.
  const anchored = !compact

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
  // The catalog may be empty — an installation that deleted every topic is coherent — and then the
  // control is not rendered at all rather than rendered offering nothing.
  const { data: commentTopics = [] } = useQuery({
    queryKey: ["comment-topics"],
    queryFn: listCommentTopics,
  })

  const entries = useMemo(() => mergeStream(comments, events, scope), [comments, events, scope])

  function invalidateComments() {
    void queryClient.invalidateQueries({ queryKey: commentsKey })
  }

  const addMutation = useMutation({
    mutationFn: () => addComment(issueId, draft.trim(), topicIdOf(draftTopicId)),
    onSuccess: () => {
      setDraft("")
      setDraftTopicId(NO_TOPIC)
      invalidateComments()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not add the comment")),
  })

  // ⚠️ The topic goes with every edit, always. One request record serves both moves on the server, so a
  // save that left it out would clear the topic off a comment somebody only meant to reword.
  const editMutation = useMutation({
    mutationFn: () => editComment(issueId, editingId as string, editingBody.trim(), topicIdOf(editingTopicId)),
    onSuccess: () => {
      setEditingId(null)
      setEditingBody("")
      setEditingTopicId(NO_TOPIC)
      invalidateComments()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update the comment")),
  })

  const replyMutation = useMutation({
    mutationFn: () => addComment(issueId, replyDraft.trim(), topicIdOf(replyTopicId), replyingToId),
    onSuccess: () => {
      setReplyingToId(null)
      setReplyDraft("")
      setReplyTopicId(NO_TOPIC)
      invalidateComments()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not post the reply")),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(issueId, commentId),
    onSuccess: invalidateComments,
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the comment")),
  })

  // A link followed from inside the page already open — one comment pointing at another — changes the
  // hash without remounting anything, so the fragment has to be watched rather than read once.
  useEffect(() => {
    function readHash() {
      const next = commentIdFromHash()

      if (next) {
        setLinkedCommentId(next)
      }
    }

    window.addEventListener("hashchange", readHash)

    return () => window.removeEventListener("hashchange", readHash)
  }, [])

  // ⚠️ A link opened while the stream is filtered to Changes scrolls to nothing at all, silently. The
  // filter is a reader's preference; being sent somewhere specific outranks it.
  useEffect(() => {
    if (linkedCommentId && scope === "changes") {
      setScope("all")
    }
  }, [linkedCommentId, scope])

  // ⚠️ Not on mount: the comment arrives from a query and is not in the DOM on the first paint. This
  // runs again on every render of the list until the element exists, then scrolls once and starts the
  // fade — the highlight answers "which one did you mean" and then gets out of the way.
  useEffect(() => {
    if (!linkedCommentId || !anchored) {
      return
    }

    const element = document.getElementById(commentAnchorId(linkedCommentId))

    if (!element) {
      return
    }

    element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" })

    const timer = window.setTimeout(() => setLinkedCommentId(null), 2200)

    return () => window.clearTimeout(timer)
  }, [linkedCommentId, entries, anchored])

  function startEditing(comment: Comment) {
    setReplyingToId(null)
    setEditingId(comment.id)
    setEditingBody(comment.body)
    setEditingTopicId(comment.topic?.id ?? NO_TOPIC)
  }

  function startReplying(commentId: string) {
    setEditingId(null)
    setReplyingToId(commentId)
    setReplyDraft("")
    setReplyTopicId(NO_TOPIC)
  }

  async function copyLink(commentId: string) {
    const link = `${window.location.origin}${window.location.pathname}#${commentAnchorId(commentId)}`

    try {
      await navigator.clipboard.writeText(link)
      toast.success("Link copied")
    } catch {
      // ⚠️ The clipboard needs a secure context and can be refused outright. Saying "copied" when
      // nothing was is worse than saying nothing, so the link goes in the message to be taken by hand.
      toast.error(`Could not copy it. The link is ${link}`)
    }
  }

  return (
    <section className={cn("space-y-4", compact && "space-y-2.5", !compact && ISSUE_SECTION_GUTTER)}>
      {/* ⚠️ Not an `IssueContentSection`, and the exception is deliberate: this one never folds — it is
          what the reader came down the page for, and the two above it fold precisely so it arrives
          sooner — and in the quick view it carries no heading at all. What it does share is the shared
          section's TYPE and its GUTTER, so the three headings in the column land on one left edge. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!compact && (
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activity</h2>
        )}
        {/* Sized to its three words, not to the column it happens to sit in: a control stretched the
            width of a page reads as a navigation bar rather than as a filter on the list below it. */}
        <SegmentedControl
          ariaLabel="Filter the activity"
          segments={SCOPES.map((entry) => ({ value: entry.scope, label: entry.label }))}
          value={scope}
          onChange={setScope}
        />
      </div>

      {canComment && (
        <CommentEditor
          body={draft}
          onBodyChange={setDraft}
          topicId={draftTopicId}
          onTopicChange={setDraftTopicId}
          topics={commentTopics}
          submitLabel="Comment"
          placeholder="Add a comment…"
          pending={addMutation.isPending}
          rows={compact ? 2 : 3}
          onSubmit={() => addMutation.mutate()}
        />
      )}

      {(commentsLoading || historyLoading) && <Skeleton className="h-24 w-full" />}

      {!commentsLoading && !historyLoading && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      )}

      {/* A gutter of avatars with the text beside it — not a stack of cards. A card draws a box around
          whatever is inside it, and "Test" in a box reads as an empty box; a line of text reads as a
          short remark, which is what it is.

          ⚠️ **One hairline between entries, and room either side of it.** `space-y` alone left the stream
          reading as one paragraph in the 290px rail — a comment, a change and the next comment with
          nothing to say where one ended. A rule is what a card was wanted for; the padding is what makes
          the rule legible rather than decorative. It divides the *entries*, so a thread's replies stay
          inside their parent and do not get one. */}
      <ol className="divide-y divide-border/60">
        {entries.map((entry) =>
          entry.kind === "comment" ? (
            <li key={entry.id} className={cn(compact ? "py-2.5" : "py-3", "first:pt-0 last:pb-0")}>
              <CommentEntry
                comment={entry.comment}
                anchored={anchored}
                linked={linkedCommentId === entry.comment.id}
                editing={editingId === entry.comment.id}
                canReply={canComment}
                onCopyLink={copyLink}
                onStartEditing={startEditing}
                onStartReplying={() => startReplying(entry.comment.id)}
                onDelete={() => deleteMutation.mutate(entry.comment.id)}
                deleting={deleteMutation.isPending}
                replyCount={entry.replies.length}
                editor={
                  <CommentEditor
                    body={editingBody}
                    onBodyChange={setEditingBody}
                    topicId={editingTopicId}
                    onTopicChange={setEditingTopicId}
                    topics={commentTopics}
                    submitLabel="Save"
                    pending={editMutation.isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={() => editMutation.mutate()}
                  />
                }
              />

              {/* A reply lives inside its parent's entry, inset rather than boxed. The stream is
                  deliberately not a stack of cards (see the note on the list above), and a reply is
                  exactly the entry that would tempt somebody to start drawing them. */}
              {(entry.replies.length > 0 || replyingToId === entry.comment.id) && (
                <ol className="mt-2.5 space-y-2.5 border-l pl-4 ml-3">
                  {entry.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentEntry
                        comment={reply}
                        anchored={anchored}
                        linked={linkedCommentId === reply.id}
                        editing={editingId === reply.id}
                        // ⚠️ No Reply control on a reply. Replies go one level deep and the server
                        // refuses a second; offering a button that always fails would be worse than
                        // offering none.
                        canReply={false}
                        onCopyLink={copyLink}
                        onStartEditing={startEditing}
                        onStartReplying={() => undefined}
                        onDelete={() => deleteMutation.mutate(reply.id)}
                        deleting={deleteMutation.isPending}
                        replyCount={0}
                        editor={
                          <CommentEditor
                            body={editingBody}
                            onBodyChange={setEditingBody}
                            topicId={editingTopicId}
                            onTopicChange={setEditingTopicId}
                            topics={commentTopics}
                            submitLabel="Save"
                            pending={editMutation.isPending}
                            onCancel={() => setEditingId(null)}
                            onSubmit={() => editMutation.mutate()}
                          />
                        }
                      />
                    </li>
                  ))}

                  {/* Under the parent, never in the page-level box: a reply written up there would be
                      a reply nobody could see they were writing. */}
                  {replyingToId === entry.comment.id && (
                    <li>
                      <CommentEditor
                        body={replyDraft}
                        onBodyChange={setReplyDraft}
                        topicId={replyTopicId}
                        onTopicChange={setReplyTopicId}
                        topics={commentTopics}
                        submitLabel="Reply"
                        placeholder="Reply…"
                        pending={replyMutation.isPending}
                        onCancel={() => setReplyingToId(null)}
                        onSubmit={() => replyMutation.mutate()}
                      />
                    </li>
                  )}
                </ol>
              )}
            </li>
          ) : (
            // A field change is one line. It has no body to give it height, so giving it a box only
            // gave it emptiness — and the changes are the entries there are most of.
            <li
              key={entry.id}
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5",
                compact ? "py-2.5" : "py-3",
                "first:pt-0 last:pb-0",
              )}
            >
              <StreamAvatar member={entry.event.actor} />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{memberName(entry.event.actor)}</span>{" "}
                {isAgent(entry.event.actor) && (
                  <>
                    <AgentBadge member={entry.event.actor} />{" "}
                  </>
                )}
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
 * One comment — a parent or a reply, which are the same thing rendered at two widths.
 *
 * ⚠️ **The left rule is the topic's colour, and it is a rule rather than a border** (TSSR-30). A border
 * on all four sides makes a card, and the note on the list above says why this stream is not made of
 * them: "Test" in a box reads as an empty box. A topic with no colour gets no rule at all — not a grey
 * one, which would read as a topic whose colour happens to be grey.
 */
function CommentEntry({
  comment,
  anchored,
  linked,
  editing,
  canReply,
  onCopyLink,
  onStartEditing,
  onStartReplying,
  onDelete,
  deleting,
  replyCount,
  editor,
}: {
  comment: Comment
  anchored: boolean
  linked: boolean
  editing: boolean
  canReply: boolean
  onCopyLink: (commentId: string) => void
  onStartEditing: (comment: Comment) => void
  onStartReplying: () => void
  onDelete: () => void
  deleting: boolean
  replyCount: number
  editor: ReactNode
}) {
  const topicStyle = commentTopicStyle(comment.topic?.color)

  return (
    <div
      // ⚠️ The anchor belongs to the page's copy only — see `anchored` where it is computed.
      id={anchored ? commentAnchorId(comment.id) : undefined}
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 rounded-md transition-colors",
        // Clear of the sticky chrome, or a linked comment lands underneath it and the link reads as
        // having gone to the wrong place.
        "scroll-mt-24",
        // Fades on its own. A tint that stayed would read as a status the comment has, rather than as
        // an answer to "which one did you mean".
        linked && "bg-primary/10 ring-1 ring-primary/30",
      )}
    >
      <StreamAvatar member={comment.author} />
      <div className="min-w-0">
        {/* ⚠️ WRAPS, and that is what keeps the quick view from scrolling sideways. Four of the things
            on this line are `shrink-0` — the kind, the topic, the agent, the time — so the row's
            min-content width is well over the 290px rail they sit in, and a `overflow-y-auto` dialog
            turns any horizontal overflow into a scrollbar across the whole modal (CSS will not leave
            one axis visible while the other scrolls). Wrapping is the fix; clipping would only hide
            the time. */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium">{memberName(comment.author)}</span>
          {isAgent(comment.author) && <AgentBadge member={comment.author} />}
          <KindBadge kind="comment" />
          {/* Nothing at all when there is none — an em dash on nine rows out of ten is noise. */}
          {comment.topic && <TopicBadge topic={comment.topic} />}
          <Timestamp at={comment.createdAt} />

          {!editing && (
            // ⚠️ **Legible as controls, and no taller than the line they sit on.** They were four bare
            // words at `opacity-0`, which read as text that happened to respond to a click — and on a
            // touch screen, which has no hover, as nothing at all. They are chips now: a border says
            // "button" where a colour change only says "link". Held at 70% until the row is under the
            // pointer or holds focus, so a stream of twenty does not read as a wall of buttons.
            <span className="ml-auto flex shrink-0 items-center gap-1 opacity-70 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {/* ⚠️ Not gated on `editable`. Anybody who can read a comment may point somebody at it;
                  the pair below is hidden on other people's comments, and this must not go with them. */}
              <ActivityAction onClick={() => onCopyLink(comment.id)}>Get link</ActivityAction>
              {canReply && <ActivityAction onClick={onStartReplying}>Reply</ActivityAction>}
              {comment.editable && (
                <>
                  <ActivityAction onClick={() => onStartEditing(comment)}>Edit</ActivityAction>
                  <ActivityAction
                    destructive
                    // ⚠️ The count, before it happens. Deleting a parent takes its replies with it, and
                    // a cascade nobody was warned about is the version people are right to hate.
                    title={
                      replyCount > 0
                        ? `Deletes this comment and its ${replyCount} ${replyCount === 1 ? "reply" : "replies"}`
                        : undefined
                    }
                    onClick={onDelete}
                    disabled={deleting}
                  >
                    {replyCount > 0 ? `Delete (+${replyCount})` : "Delete"}
                  </ActivityAction>
                </>
              )}
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-1.5">{editor}</div>
        ) : (
          // Capped at a readable measure so a long comment does not run the width of a wide page, and a
          // short one does not sit alone in a field of nothing.
          //
          // ⚠️ Rendered rather than printed. A comment is where somebody writes "blocked by TES-42" or
          // pastes a table, and `whitespace-pre-wrap` showed both as the characters they typed — which
          // is the difference between a tracker people write in and one they write around.
          <div className={cn("max-w-[68ch] text-sm text-foreground/90", topicStyle.ruleStyle && "relative pl-3")}>
            {topicStyle.ruleStyle && (
              <span
                aria-hidden
                className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-full"
                style={topicStyle.ruleStyle}
              />
            )}
            <TesseraMarkdown markdown={comment.body} />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * One of a comment's controls: Get link, Reply, Edit, Delete.
 *
 * ⚠️ **A chip, and deliberately not a {@code Button}.** The smallest button this product has is `h-8`,
 * which is taller than the line of metadata these sit in — four of them would push every comment's header
 * onto two rows in the rail, which is the opposite of what was asked for. So: a border and a hover fill for
 * the affordance, `text-[11px]` and `py-0.5` for the height. More visible, no bigger.
 */
function ActivityAction({
  children,
  onClick,
  title,
  disabled = false,
  destructive = false,
}: {
  children: ReactNode
  onClick: () => void
  title?: string
  disabled?: boolean
  /** Delete, which gets its colour on hover only — a red chip on every comment reads as a warning. */
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded border px-1.5 py-0.5 text-[11px] leading-none transition-colors",
        "border-border/70 text-muted-foreground disabled:opacity-50",
        destructive
          ? "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive-ink"
          : "hover:border-border hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

/**
 * The box a comment is written in — the page-level composer, an inline edit, and a reply, which differ
 * by their labels and by nothing else.
 *
 * ⚠️ **The topic is always part of it, including when it is being cleared.** One request record serves
 * create and edit on the server, so an editor that did not carry the topic would drop it off a comment
 * somebody only meant to reword.
 */
function CommentEditor({
  body,
  onBodyChange,
  topicId,
  onTopicChange,
  topics,
  submitLabel,
  placeholder,
  pending,
  rows = 3,
  onCancel,
  onSubmit,
}: {
  body: string
  onBodyChange: (next: string) => void
  topicId: string
  onTopicChange: (next: string) => void
  topics: CommentTopicResponse[]
  submitLabel: string
  placeholder?: string
  pending: boolean
  rows?: number
  onCancel?: () => void
  onSubmit: () => void
}) {
  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={4000}
        autoFocus={onCancel !== undefined}
      />
      {/* The topic shares the button's row rather than taking one of its own: in the rail this composer
          is two lines tall, and a control above the box would push the box out of it. */}
      <div className="flex items-center justify-between gap-2">
        <TopicSelect
          topics={topics}
          value={topicId}
          onChange={onTopicChange}
          ariaLabel="What this comment is about"
        />
        <div className="flex shrink-0 gap-2">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button size="sm" disabled={body.trim().length === 0 || pending} onClick={onSubmit}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * What a comment is about, offered beside the box.
 *
 * ⚠️ **Nothing at all when the catalog is empty.** Deleting every topic is allowed — a topic is
 * optional — and a select whose only option is "No topic" is a control that asks a question with one
 * answer.
 *
 * Narrow on purpose: it shares a row with the Save/Comment button so the composer keeps its height in
 * the rail, and a full-width select there would read as the more important of the two.
 */
function TopicSelect({
  topics,
  value,
  onChange,
  ariaLabel,
}: {
  topics: CommentTopicResponse[]
  value: string
  onChange: (next: string) => void
  ariaLabel: string
}) {
  if (topics.length === 0) {
    return <span />
  }

  return (
    <Select value={value} onValueChange={onChange}>
      {/* Shrinks rather than holding 12rem: in the quick view's rail the buttons beside it are what
          must stay whole, and a select that refuses to give width back is the other way a dialog ends
          up scrolling sideways. */}
      <SelectTrigger size="sm" className="w-48 min-w-0 shrink" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TOPIC}>No topic</SelectItem>
        {topics.map((topic) => (
          <SelectItem key={topic.id} value={topic.id}>
            {topic.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * The topic on a posted comment.
 *
 * Outlined rather than tinted, like {@link AgentBadge} and unlike {@link KindBadge}: the kind is a
 * category the stream is built on, where this is an annotation somebody chose to add. Two solid chips
 * side by side would compete, and the one that matters less would win on colour.
 */
function TopicBadge({ topic }: { topic: CommentTopicSummary }) {
  const style = commentTopicStyle(topic.color)

  return (
    <span
      title={`About: ${topic.name}`}
      className={cn(
        "inline-flex max-w-[14rem] shrink-0 translate-y-px items-center gap-1 rounded border px-1.5 py-px text-[10px] font-medium",
        style.chipClassName,
      )}
      style={style.chipStyle}
    >
      <CommentTopicIcon iconKey={topic.iconKey} />
      <span className="truncate">{topic.name}</span>
    </span>
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

/**
 * That this was done through an agent, said next to the person who is still answerable for it.
 *
 * ⚠️ **Beside the name, never instead of it, and the avatar does not change.** The person asked for
 * this; the agent is how it got written. Swapping either of them out would answer a question nobody
 * asked and quietly lose the one that matters — *who wanted this*.
 *
 * Visually distinct from {@link KindBadge} on purpose: that one is a category, so it is a solid tint in
 * small caps; this one is an annotation, so it is outlined and reads in ordinary case. The icon carries
 * the colour, which keeps the chip legible across every theme without competing with the name.
 */
/**
 * That this line was written by a client rather than by somebody typing (TSSR-36).
 *
 * ⚠️ **It takes the member, not a name, and that is the whole change.** It used to be handed a bare
 * string carried in a column beside the author, and it rendered *"SU · via Claude Code"* — a person's
 * chip with somebody else's identity glued to it. The client is the author now, so the chip beside this
 * badge already **is** the agent: its own name, its own generated face. The badge says what kind of
 * thing that is, and stops claiming anything about who.
 *
 * ⚠️ **A retired client keeps its by-line**, which is the point of never deleting the row: history has
 * to outlive what it names. The badge says so rather than the line going blank.
 */
function AgentBadge({ member }: { member: MemberSummary | null }) {
  const name = memberName(member)
  const retired = member?.retired === true

  return (
    <span
      title={
        retired
          ? `Written through ${name}, a client that has since been switched off`
          : `Written through ${name}, a client acting for the person who approved it`
      }
      className="inline-flex max-w-[14rem] shrink-0 translate-y-px items-center gap-1 rounded border border-primary/25 bg-primary/[0.06] px-1.5 py-px text-[10px] font-medium text-foreground/70"
    >
      <Bot className="size-2.5 shrink-0 text-primary" />
      <span className="truncate">{retired ? "client, retired" : "client"}</span>
    </span>
  )
}

/** The stream's gutter: an avatar and nothing else, since the name is already on the line beside it. */
function StreamAvatar({ member }: { member: MemberSummary | null }) {
  return <MemberAvatar member={member} className="mt-0.5 size-6 shrink-0" />
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

/**
 * The merge itself: two lists into one, newest first, filtered by what the reader asked to see.
 *
 * ⚠️ **A reply is not an entry in this stream** (TSSR-26); it is a child of one. Threading and a
 * chronological merge are in tension, and this is where the tension is resolved:
 *
 * - Only top-level comments take a place in the ordering. Their replies travel with them.
 * - **A reply does not move its parent.** The parent keeps its own `createdAt`. Bumping a thread on
 *   every answer would reorder it around the field changes it sits between, and this is a record of
 *   what happened, not an inbox.
 * - The `comments` scope shows replies too — they are comments. The `changes` scope shows neither.
 * - The count the empty state reads is therefore top-level: a parent with four replies is one entry.
 */
function mergeStream(comments: Comment[], events: ActivityLog[], scope: StreamScope): StreamEntry[] {
  const entries: StreamEntry[] = []

  if (scope !== "changes") {
    const repliesByParent = new Map<string, Comment[]>()

    for (const comment of comments) {
      if (comment.parentCommentId) {
        const existing = repliesByParent.get(comment.parentCommentId) ?? []

        existing.push(comment)
        repliesByParent.set(comment.parentCommentId, existing)
      }
    }

    for (const comment of comments) {
      if (comment.parentCommentId) {
        continue
      }

      entries.push({
        kind: "comment",
        id: `comment-${comment.id}`,
        at: comment.createdAt,
        comment,
        // Oldest first inside a thread, whichever way the stream around it runs: a conversation is
        // read forwards, and an answer above the thing it answers is unreadable.
        replies: (repliesByParent.get(comment.id) ?? []).sort(
          (first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt),
        ),
      })
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

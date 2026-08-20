import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@jmouse/ui"
import {
  AdministrationSection,
  CatalogDialog,
  DeleteWithUsage,
  ReadOnlyNotice,
  RenameWarning,
  useCatalogMutation,
} from "@/components/administration/AdministrationPieces"
import {
  createCommentTopic,
  deleteCommentTopic,
  fetchCommentTopicIcons,
  fetchCommentTopicUsage,
  fetchConfigurationCounts,
  listCommentTopics,
  updateCommentTopic,
  type CommentTopicResponse,
} from "@/api/configurationAdministration"
import { CommentTopicIcon, commentTopicStyle } from "@/components/issues/commentTopicVisuals"
import { cn } from "@/lib/helpers"

/**
 * The comment-topic catalog — what a remark on an issue may be said to be about.
 *
 * ⚠️ **Unlike resolutions, this list may be emptied.** A topic is optional: an installation with none
 * simply means nobody labels their discussion, which is coherent rather than broken. It is the same
 * exemption link types have, and the opposite of the resolution rule right above it in this screen.
 *
 * ⚠️ **A topic says what a comment is about, never what it is.** Discussion stays out of the activity
 * log (ADR-0007) and a topic does not move it in.
 */
export function CommentTopicsSection({ canAdminister }: { canAdminister: boolean }) {
  const [editing, setEditing] = useState<CommentTopicResponse | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: commentTopics = [], refetch } = useQuery({
    queryKey: ["administration", "comment-topics"],
    queryFn: listCommentTopics,
  })

  const { data: counts } = useQuery({
    queryKey: ["administration", "counts"],
    queryFn: fetchConfigurationCounts,
  })

  return (
    <AdministrationSection
      title="Comment topics"
      description="What a comment is about — offered beside the box, never required. Shared by every project, and this list may be empty, which simply means nobody labels their discussion."
      actions={
        canAdminister && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New topic
          </Button>
        )
      }
    >
      {!canAdminister && <ReadOnlyNotice />}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-40">Comments using it</TableHead>
            {canAdminister && <TableHead className="w-32" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {commentTopics.map((commentTopic) => (
            <TableRow key={commentTopic.id}>
              <TableCell className="font-medium">
                <CommentTopicChip topic={commentTopic} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{commentTopic.description ?? "—"}</TableCell>
              {/* ⚠️ `?? 0` is load-bearing: a topic nothing holds is absent from the map, not zero. */}
              <TableCell className="text-sm">{counts?.commentsByTopic[commentTopic.id] ?? 0}</TableCell>
              {canAdminister && (
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(commentTopic)}>
                      Edit
                    </Button>
                    <DeleteWithUsage
                      name={commentTopic.name}
                      noun="comment topic"
                      usageQueryKey={["administration", "comment-topic-usage", commentTopic.id]}
                      fetchUsage={() => fetchCommentTopicUsage(commentTopic.id)}
                      onDelete={() => deleteCommentTopic(commentTopic.id)}
                      onDeleted={() => void refetch()}
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {creating && <CommentTopicDialog onClose={() => setCreating(false)} onSaved={() => void refetch()} />}
      {editing && (
        <CommentTopicDialog
          commentTopic={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void refetch()}
        />
      )}
    </AdministrationSection>
  )
}

function CommentTopicDialog({
  commentTopic,
  onClose,
  onSaved,
}: {
  commentTopic?: CommentTopicResponse
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(commentTopic?.name ?? "")
  const [description, setDescription] = useState(commentTopic?.description ?? "")
  const [iconKey, setIconKey] = useState(commentTopic?.iconKey ?? "")
  const [color, setColor] = useState(commentTopic?.color ?? "")

  const trimmedColor = color.trim()

  // Built from the server's own list, so the picker can never offer a key the server would refuse or
  // this build could not draw — the mismatch shows up here rather than after somebody saves.
  const { data: iconKeys = [] } = useQuery({
    queryKey: ["administration", "comment-topic-icons"],
    queryFn: fetchCommentTopicIcons,
  })

  const save = useCatalogMutation({
    mutationFn: () => {
      const request = {
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
        iconKey: iconKey.length > 0 ? iconKey : null,
        color: trimmedColor.length > 0 ? trimmedColor : null,
      }

      return commentTopic ? updateCommentTopic(commentTopic.id, request) : createCommentTopic(request)
    },
    success: commentTopic ? "Comment topic updated" : "Comment topic created",
    failure: "Could not save the comment topic",
    onDone: () => {
      onSaved()
      onClose()
    },
  })

  return (
    <CatalogDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
      title={commentTopic ? `Edit ${commentTopic.name}` : "New comment topic"}
      description="Comment topics are shared by every project, and offered beside the comment box on every issue."
      submitLabel={commentTopic ? "Save" : "Create"}
      canSubmit={name.trim().length > 0}
      isPending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="comment-topic-name">Name</Label>
        <Input
          id="comment-topic-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="comment-topic-description">Description</Label>
        <Input
          id="comment-topic-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What a comment under this heading should say"
          maxLength={255}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Icon</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {iconKeys.map((candidate) => (
            <button
              key={candidate}
              type="button"
              title={candidate}
              aria-label={candidate}
              aria-pressed={iconKey === candidate}
              onClick={() => setIconKey(iconKey === candidate ? "" : candidate)}
              className={cn(
                "flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-accent",
                iconKey === candidate && "border-primary bg-primary/10",
              )}
            >
              <CommentTopicIcon iconKey={candidate} className="size-4" />
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Click the chosen one again to clear it. A topic with no icon draws the generic mark.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="comment-topic-color">Colour</Label>

        <div className="flex flex-wrap items-center gap-1.5">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              title={preset.name}
              aria-label={preset.name}
              aria-pressed={trimmedColor.toLowerCase() === preset.value}
              onClick={() => setColor(preset.value)}
              className={cn(
                "size-6 rounded-full border transition-transform hover:scale-110",
                trimmedColor.toLowerCase() === preset.value && "ring-2 ring-ring ring-offset-1",
              )}
              style={{ backgroundColor: preset.value }}
            />
          ))}
          <Button variant="ghost" size="sm" disabled={trimmedColor.length === 0} onClick={() => setColor("")}>
            Clear
          </Button>
        </div>

        <Input
          id="comment-topic-color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          placeholder="#8b5cf6"
          maxLength={16}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview</span>
          <CommentTopicChip
            topic={{
              id: "preview",
              name: name.trim() || "Topic",
              description: null,
              iconKey: iconKey.length > 0 ? iconKey : null,
              color: trimmedColor.length > 0 ? trimmedColor : null,
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Any CSS colour, or a swatch. A comment with this topic also gets a thin rule down its left edge
          in the same colour; blank leaves it with none.
        </p>
      </div>

      {commentTopic && <RenameWarning currentName={commentTopic.name} nextName={name} />}
    </CatalogDialog>
  )
}

/** The topic exactly as a comment shows it, so the picker and the thread cannot look like two things. */
function CommentTopicChip({ topic }: { topic: CommentTopicResponse }) {
  const style = commentTopicStyle(topic.color)

  return (
    <span
      className={cn(
        "inline-flex max-w-[14rem] items-center gap-1 rounded border px-1.5 py-px text-[11px] font-medium",
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
 * Colours offered as a starting point — a convenience, not the model.
 *
 * Spread far enough apart to stay distinguishable at chip size, and matching the eight the status
 * picker offers so the two screens do not each have their own idea of what a colour is.
 */
const COLOR_PRESETS: Array<{ value: string; name: string }> = [
  { value: "#64748b", name: "Slate" },
  { value: "#0ea5e9", name: "Sky" },
  { value: "#10b981", name: "Emerald" },
  { value: "#f59e0b", name: "Amber" },
  { value: "#8b5cf6", name: "Violet" },
  { value: "#f43f5e", name: "Rose" },
  { value: "#14b8a6", name: "Teal" },
  { value: "#f97316", name: "Orange" },
]

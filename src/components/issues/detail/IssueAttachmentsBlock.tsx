import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, FileText, ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@jmouse/ui"
import { MemberAvatar } from "@/components/MemberAvatar"
import { IssueContentSection } from "@/components/issues/detail/IssueContentSection"
import { useStoredPreference } from "@/hooks/useStoredPreference"
import { apiErrorMessage } from "@/api/errors"
import { downloadAttachment, useAttachmentBytes } from "@/api/attachmentBytes"
import { AttachmentViewerDialog } from "@/components/issues/detail/AttachmentViewerDialog"
import { searchMembers, type MemberSummary } from "@/api/members"
import { memberName } from "@/lib/memberDisplay"
import {
  deleteAttachment,
  listAttachments,
  uploadAttachment,
  type Attachment,
} from "@/api/attachments"
import { cn } from "@/lib/helpers"

const BLOCK_PREFERENCE_KEY = "tessera.issue.attachments"

/** What previews rather than being described. Raster only — an SVG is a script host, not a thumbnail. */
const PREVIEWABLE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"])

/**
 * The files hanging off an issue.
 *
 * <h2>⚠️ A list, not a gallery</h2>
 *
 * <p>These are documents somebody needs to <em>find again</em> — a specification, an export, the
 * screenshot of the fault. A gallery is the right shape for pictures one browses and the wrong one for
 * a spreadsheet, and a grid of file-type glyphs is a gallery of nothing. So: rows that say what a thing
 * is, with a thumbnail where a thumbnail is the fastest way to recognise it.</p>
 *
 * <h2>⚠️ Paste is the commonest way a screenshot arrives, and the easiest to leave out</h2>
 *
 * <p>Somebody presses PrintScreen and then Ctrl-V. A drop target alone means saving the image to disk
 * first, finding it, and dragging it back — three steps to do what one keystroke should. The paste
 * listener is on the drop zone rather than the document, so pasting into the description editor still
 * pastes text.</p>
 *
 * <h2>⚠️ Deleting is kept out of hover-reach of opening</h2>
 *
 * <p>The row opens the file; removing it is a separate control with its own confirmation. They are a
 * few pixels apart on every other design of this, and the one that cannot be undone is the one that
 * gets clicked by accident.</p>
 */
export function IssueAttachmentsBlock({
  issueId,
  canEdit,
  variant = "page",
}: {
  issueId: string
  canEdit: boolean
  variant?: "page" | "quick"
}) {
  const isPage = variant === "page"
  const queryClient = useQueryClient()

  // ⚠️ **Closed until somebody opens it**, and then open for good — the preference outlives the tab.
  // Most issues carry no attachment at all, so the open default spent four lines of a reader's screen
  // saying "nothing here" between the description and the relations. The count in the heading is what
  // answers that question now, without the block having to be open to do it.
  const [preference, remember] = useStoredPreference<"open" | "closed">(BLOCK_PREFERENCE_KEY, "closed")
  const [dragging, setDragging] = useState(false)
  const [removing, setRemoving] = useState<Attachment | null>(null)
  const [viewing, setViewing] = useState<Attachment | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const open = !isPage || preference === "open"

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["issue", issueId, "attachments"],
    queryFn: () => listAttachments(issueId),
  })

  // ⚠️ The library answers with an uploader ID and nothing else — it has no notion of a member, and
  // acquiring one is the last thing a shared file module should do. So the name and the face are looked
  // up HERE, from the same cached list every other screen uses: one query for the whole product rather
  // than one per row, and a shared key so opening an issue costs nothing after the first.
  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers() })
  const uploaderOf = (id: string | null) => (id ? members.find((member) => member.id === id) ?? null : null)

  const settled = () => {
    queryClient.invalidateQueries({ queryKey: ["issue", issueId, "attachments"] })
    // Attaching and removing both write an entry into the issue's history (TSSR-49), so the stream
    // beneath this block is stale the moment either happens.
    queryClient.invalidateQueries({ queryKey: ["issue", issueId, "activity"] })
  }

  const upload = useMutation({
    mutationFn: (file: File) => uploadAttachment(issueId, file),
    onSuccess: settled,
    onError: (error) => toast.error(apiErrorMessage(error, "That file could not be attached.")),
  })

  const remove = useMutation({
    mutationFn: (attachment: Attachment) => deleteAttachment(attachment.id),
    onSuccess: () => {
      setRemoving(null)
      settled()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "That file could not be removed.")),
  })

  const attach = (files: FileList | File[] | null) => {
    for (const file of Array.from(files ?? [])) {
      upload.mutate(file)
    }
  }

  const body = (
    <div
      onDragOver={(event) => {
        if (!canEdit) {
          return
        }

        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (!canEdit) {
          return
        }

        event.preventDefault()
        setDragging(false)
        attach(event.dataTransfer.files)
      }}
      /*
       * ⚠️ Pasting needs the element to be focusable, which is why it carries a tabIndex it does not
       * otherwise want. Without it the paste event never reaches here and lands on the document, where
       * nothing is listening.
       */
      tabIndex={canEdit ? 0 : undefined}
      onPaste={(event) => {
        if (!canEdit) {
          return
        }

        const pasted = Array.from(event.clipboardData.files)

        if (pasted.length > 0) {
          event.preventDefault()
          attach(pasted)
        }
      }}
      className={cn(
        "rounded-md transition-colors focus-visible:outline-none",
        dragging && "bg-accent/60 ring-2 ring-primary ring-offset-1",
      )}
    >
      {isLoading && <p className="py-1 text-xs text-muted-foreground">Loading…</p>}

      {!isLoading && attachments.length === 0 && (
        <p className="py-1 text-xs text-muted-foreground">
          {canEdit ? "Nothing attached. Drop a file here, or paste a screenshot." : "Nothing attached."}
        </p>
      )}

      <ul className="divide-y">
        {attachments.map((attachment) => (
          <AttachmentRow
            key={attachment.id}
            attachment={attachment}
            canEdit={canEdit}
            uploader={uploaderOf(attachment.uploadedBy)}
            onOpen={() => setViewing(attachment)}
            onRemove={() => setRemoving(attachment)}
          />
        ))}
      </ul>

      {upload.isPending && (
        <p className="flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Attaching…
        </p>
      )}
    </div>
  )

  return (
    <>
      <IssueContentSection
        id={`attachments-${issueId}`}
        title="Attachments"
        meta={attachments.length > 0 ? attachments.length : null}
        open={open}
        onToggle={isPage ? () => remember(open ? "closed" : "open") : undefined}
        action={
          canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="mr-1 size-3" />
              Attach
            </Button>
          )
        }
      >
        {body}
      </IssueContentSection>

      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          attach(event.target.files)
          // Cleared so choosing the SAME file after removing it fires a change event again.
          event.target.value = ""
        }}
      />

      <AttachmentViewerDialog attachment={viewing} onOpenChange={(next) => !next && setViewing(null)} />

      {removing && (
        <ConfirmRemoval
          attachment={removing}
          pending={remove.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={() => remove.mutate(removing)}
        />
      )}
    </>
  )
}

/**
 * One file.
 *
 * <h2>⚠️ Nothing here is an ordinary link, and that is not a style choice</h2>
 *
 * <p>Tessera authenticates with a bearer token in a header. An `&lt;img src&gt;`, an `&lt;a href&gt;` and a
 * browser download all send <strong>no header at all</strong>, so every one of them answers `401`: a
 * broken thumbnail and a blank tab, which read as <em>the file is missing</em>. The bytes are fetched
 * with the reader's own credentials and handed to the browser as an object URL — see
 * {@link useAttachmentBytes} for why this is right rather than a public token route.</p>
 *
 * <p>⚠️ Only a <strong>previewable</strong> attachment is fetched. Pulling a 30 MB export down to draw a
 * 32-pixel icon of a document would be the whole file, per row, for nothing.</p>
 */
function AttachmentRow({
  attachment,
  canEdit,
  uploader,
  onOpen,
  onRemove,
}: {
  attachment: Attachment
  canEdit: boolean
  uploader: MemberSummary | null
  onOpen: () => void
  onRemove: () => void
}) {
  const previewable = PREVIEWABLE.has(attachment.contentType)
  const preview = useAttachmentBytes(attachment.id, previewable)

  return (
    <li className="group flex items-center gap-2.5 py-1.5 pl-1 pr-1">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded px-1 py-0.5 text-left hover:bg-accent/60"
        title={`Open ${attachment.name}`}
      >
        {previewable ? (
          /* No `src` until the bytes arrive: an <img> pointed at the authenticated route paints a
             broken-image glyph for the moment before it fails, which is worse than an empty frame. */
          <span className="size-8 shrink-0 overflow-hidden rounded border bg-muted">
            {preview && <img src={preview} alt="" className="size-full object-cover" />}
          </span>
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground">
            {attachment.contentType.startsWith("image/") ? (
              <ImageIcon className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
          </span>
        )}

        {/*
          ⚠️ `min-w-0` on EVERY flex box down this chain, not just the outer one. A flex container's
          default `min-width: auto` means it refuses to shrink below its content — so one un-shrinkable
          row here set a floor on the whole content column, the rail was pushed past the edge, and the
          page grew a horizontal scrollbar exactly as wide as the sidebar. The names truncate instead.
        */}
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm">{attachment.name}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="shrink-0 tabular-nums">{readableSize(attachment.sizeBytes)}</span>
            {uploader && (
              <>
                <span aria-hidden className="shrink-0">·</span>
                <MemberAvatar member={uploader} className="size-4 shrink-0" />
                <span className="truncate">{memberName(uploader)}</span>
              </>
            )}
            <span aria-hidden className="shrink-0">·</span>
            <span className="shrink-0 tabular-nums">{readableDate(attachment.createdAt)}</span>
          </span>
        </span>
      </button>

      {/* ⚠️ Only revealed on hover, and at the far end of the row: opening a file is the ordinary act and
          removing it is not, so the one that cannot be undone does not sit under the cursor of the one
          that can. */}
      <button
        type="button"
        onClick={() => downloadAttachment(attachment.id, attachment.name).catch(() => toast.error("That file could not be downloaded."))}
        className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        title={`Download ${attachment.name}`}
      >
        <Download className="size-3.5" />
      </button>

      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          title={`Remove ${attachment.name}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  )
}

/**
 * ⚠️ **Named, not "Are you sure?".** The file is gone from the issue afterwards and there is no undo, so
 * the question says which file and the button says what it does.
 */
function ConfirmRemoval({
  attachment,
  pending,
  onCancel,
  onConfirm,
}: {
  attachment: Attachment
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs">
      <Paperclip className="size-3.5 shrink-0 text-destructive" />
      <span className="min-w-0 flex-1 truncate">
        Remove <span className="font-medium">{attachment.name}</span> from this issue?
      </span>
      <Button type="button" variant="ghost" size="sm" className="h-6 px-2" disabled={pending} onClick={onCancel}>
        Keep it
      </Button>
      <Button type="button" variant="destructive" size="sm" className="h-6 px-2" disabled={pending} onClick={onConfirm}>
        {pending && <Loader2 className="mr-1 size-3 animate-spin" />}
        Remove
      </Button>
    </div>
  )
}

/** Bytes, as somebody reads them. */
function readableSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ["KB", "MB", "GB"]
  let size = bytes / 1024
  let unit = 0

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }

  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`
}

/**
 * When it was attached, short.
 *
 * ⚠️ The day rather than the minute: an attachment list is scanned for *which file*, and a column of
 * timestamps to the second is noise in the way of the names. The full instant is in the issue's history,
 * which is where somebody looking for "when exactly" is already going.
 */
function readableDate(instant: string): string {
  const when = new Date(instant)

  return Number.isNaN(when.getTime())
    ? ""
    : when.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}


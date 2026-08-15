import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { TesseraMarkdown, TesseraMarkdownEditor } from "@/components/markdown/TesseraMarkdown"
import { cn } from "@/lib/helpers"

/**
 * A Markdown field that is read in place and written in place — but not, unlike
 * {@link ../inline/InlineTextField}, by being an input the whole time.
 *
 * <h2>⚠️ Why this one has an edit mode when nothing else in Tessera does</h2>
 *
 * <p>The inline pattern works because a summary looks the same typed as it does read. A description
 * does not: a table, a `;;;mermaid` diagram and a `TES-42` reference are the *rendered* thing, and a
 * field that were permanently a textarea would mean nobody ever sees them. So this shows the document
 * and swaps to the editor on request.
 *
 * <p>⚠️ **And it commits on a button rather than on blur**, which is the other break from the inline
 * pattern and the reason it cannot simply reuse it. The editor's toolbar opens dialogs; a dialog takes
 * focus; commit-on-blur would save a half-finished document every time somebody reached for the link
 * button. Escape still abandons, because that is the one habit worth keeping.
 */
export function MarkdownField({
  value,
  onCommit,
  canEdit,
  placeholder,
  emptyText,
  className,
}: {
  value: string
  onCommit: (next: string) => void
  canEdit: boolean
  placeholder?: string
  /** What an empty field says to somebody who cannot edit it — an invitation would be a lie. */
  emptyText?: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  // A commit elsewhere — the modal, another tab, a tool call — has to win over a draft nobody is
  // typing into. Re-syncing while not editing is what keeps two surfaces one issue rather than two
  // copies; doing it *while* editing would throw away what somebody is writing.
  useEffect(() => {
    if (!editing) {
      setDraft(value)
    }
  }, [value, editing])

  function commit() {
    onCommit(draft)
    setEditing(false)
  }

  function abandon() {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <div
        className="space-y-2"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            abandon()
            return
          }
          // The other half of "commits on a button": a document long enough to need a toolbar is long
          // enough that reaching for the mouse to save it is a nuisance. Escape abandons, this commits,
          // and neither is reachable by accident the way commit-on-blur was.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            commit()
          }
        }}
      >
        <TesseraMarkdownEditor value={draft} onChange={setDraft} placeholder={placeholder} />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={commit}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={abandon}>
            Cancel
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Markdown · <kbd className="font-mono">⌘↵</kbd> to save · <kbd className="font-mono">Esc</kbd> to
            discard
          </span>
        </div>
      </div>
    )
  }

  if (!value.trim()) {
    return canEdit ? (
      <button
        type="button"
        className={cn("w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent", className)}
        onClick={() => setEditing(true)}
      >
        {placeholder ?? "Add a description…"}
      </button>
    ) : (
      <p className={cn("px-2 py-1.5 text-sm text-muted-foreground", className)}>
        {emptyText ?? "Nothing written."}
      </p>
    )
  }

  return (
    <div
      className={cn("rounded-md px-2 py-1.5", canEdit && "cursor-text hover:bg-accent/40", className)}
      // ⚠️ A click that landed on a link inside the document must follow the link rather than open the
      // editor. Reading a reference is what the references are for, and having to dodge the edit mode
      // to do it would make them worse than plain text.
      onClick={(event) => {
        if (canEdit && !(event.target as HTMLElement).closest("a, button")) {
          setEditing(true)
        }
      }}
    >
      <TesseraMarkdown markdown={value} />
    </div>
  )
}

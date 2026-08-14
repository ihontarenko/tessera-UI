import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/helpers"

/**
 * A field that is read and written in the same place (ticket 07).
 *
 * There is no edit mode and no Save button: the control is always the input, drawn as plain text until
 * it is hovered or focused, and it commits when it loses focus. Escape abandons the edit, which is the
 * one thing a form's Cancel button did that nothing else covers.
 *
 * A value the field cannot send — an empty summary, or anything `accepts` rejects — is not sent. The
 * field reverts to what the server still holds instead of leaving the screen showing a value the
 * database never took.
 */
export function InlineTextField({
  value,
  onCommit,
  canEdit,
  multiline = false,
  required = false,
  accepts,
  placeholder,
  emptyText,
  maximumLength,
  className,
  ariaLabel,
}: {
  value: string
  onCommit: (next: string) => void
  canEdit: boolean
  multiline?: boolean
  required?: boolean
  /** Rejects a value before it is sent — the field reverts rather than posting something refusable. */
  accepts?: (next: string) => boolean
  /** What an empty field invites you to do. */
  placeholder?: string
  /** What an empty field says to someone who cannot edit it — an invitation would be a lie. */
  emptyText?: string
  maximumLength?: number
  className?: string
  ariaLabel: string
}) {
  const [draft, setDraft] = useState(value)
  const abandoned = useRef(false)

  // A commit elsewhere — the modal, another tab, a transition that rewrote the field — has to win over
  // a draft nobody is typing into. Re-syncing on the server's value is what makes the two surfaces one
  // issue rather than two copies.
  useEffect(() => {
    setDraft(value)
  }, [value])

  if (!canEdit) {
    return value.length > 0 ? (
      <p className={cn("whitespace-pre-wrap", className)}>{value}</p>
    ) : (
      <p className={cn("italic text-muted-foreground", className)}>{emptyText ?? "—"}</p>
    )
  }

  function commit() {
    if (abandoned.current) {
      abandoned.current = false
      setDraft(value)
      return
    }

    const next = draft.trim()

    if (next === value.trim()) {
      return
    }

    if ((required && next.length === 0) || (accepts && !accepts(next))) {
      setDraft(value)
      return
    }

    onCommit(next)
  }

  // Drawn as plain text until it is hovered or focused: the field is always the control, so there is
  // nothing to switch into and nothing to save.
  const shared = {
    value: draft,
    placeholder,
    maxLength: maximumLength,
    "aria-label": ariaLabel,
    onBlur: commit,
    className: cn(
      "border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input",
      className,
    ),
  }

  if (multiline) {
    return (
      <Textarea
        {...shared}
        rows={6}
        // The shared Textarea sizes itself to its content, which is right for a comment box and wrong
        // for a description: a long one grew to a thousand pixels and pushed the rest of the issue off
        // the screen. Here it is a panel of fixed height that scrolls inside itself.
        className={cn(shared.className, "field-sizing-fixed max-h-56 min-h-28 overflow-y-auto")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            abandoned.current = true
            event.currentTarget.blur()
          }
        }}
      />
    )
  }

  return (
    <Input
      {...shared}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          abandoned.current = true
          event.currentTarget.blur()
        }
        if (event.key === "Enter") {
          event.currentTarget.blur()
        }
      }}
    />
  )
}

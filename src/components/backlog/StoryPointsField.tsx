import { useEffect, useState } from "react"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/helpers"

/**
 * An issue's estimate, edited in place on a backlog row — estimation during planning should not cost a
 * dialog. Commits on blur and on Enter, abandons on Escape, and refuses to send anything but a number
 * or a cleared value, so a typo never reaches the issue-update path.
 *
 * A member who cannot edit issues sees the same chip, read-only.
 */
export function StoryPointsField({
  storyPoints,
  editable,
  onCommit,
}: {
  storyPoints: number | null
  editable: boolean
  onCommit: (storyPoints: number | null) => void
}) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  // A move or a server reconcile can change the estimate under an open editor; re-seed from the row.
  useEffect(() => {
    if (!editing) {
      setDraft(storyPoints === null || storyPoints === undefined ? "" : String(storyPoints))
    }
  }, [storyPoints, editing])

  const label = storyPoints === null || storyPoints === undefined ? "—" : String(storyPoints)

  if (!editable) {
    return <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{label}</span>
  }

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()

    if (trimmed.length === 0) {
      if (storyPoints !== null && storyPoints !== undefined) {
        onCommit(null)
      }
      return
    }

    const parsed = Number(trimmed)
    if (Number.isNaN(parsed) || parsed === storyPoints) {
      return
    }

    onCommit(parsed)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={t("backlog.storyPoints.edit", "Estimate")}
        className={cn(
          "w-9 shrink-0 rounded px-1 py-0.5 text-right text-xs tabular-nums transition-colors hover:bg-muted",
          storyPoints === null || storyPoints === undefined ? "text-muted-foreground" : "font-medium",
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <input
      autoFocus
      value={draft}
      inputMode="decimal"
      aria-label={t("backlog.storyPoints.edit", "Estimate")}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit()
        }
        if (event.key === "Escape") {
          setEditing(false)
        }
      }}
      className="w-9 shrink-0 rounded border bg-background px-1 py-0.5 text-right text-xs tabular-nums outline-none focus:border-primary"
    />
  )
}

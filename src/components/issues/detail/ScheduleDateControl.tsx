import { useEffect, useRef, useState } from "react"
import { XIcon } from "lucide-react"
import { Button } from "@jmouse/ui"
import { formatDay } from "@/components/issues/ScheduleBadge"
import { cn } from "@/lib/helpers"

/** Today and tomorrow as the server stores them — `YYYY-MM-DD` in the reader's own timezone. */
function dayOffsetFromToday(days: number): string {
  const day = new Date()

  day.setDate(day.getDate() + days)

  // ⚠️ Not `toISOString()`, which converts to UTC first — anybody east of Greenwich after 21:00 would
  // get tomorrow's date for "today", and the badge would then call the issue scheduled rather than
  // queued. The local parts are what the person meant.
  return [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-")
}

/**
 * One date on an issue's schedule, edited where it is read.
 *
 * <h2>⚠️ Two shortcuts and a date field, not a calendar popover</h2>
 *
 * What a person actually does with a queue date is say "today" or "tomorrow" — the whole reason the
 * field exists is to be moved in one click, and a popover that costs three would defeat it. The rarer
 * answer, an actual day, is the browser's own `date` input: it is keyboard-reachable, localised, and
 * already the control every reader knows.
 *
 * ⚠️ **A quick button toggles rather than only sets.** Pressing "Today" on something already queued for
 * today clears it — otherwise the only way out is the × beside it, and the button that put the value
 * there would be the one control that cannot take it away.
 *
 * @param quick which shortcuts to offer. A deadline gets none: "the deadline is today" is not something
 *              anybody sets in one click, and offering it invites the mis-click that makes an issue
 *              overdue tomorrow.
 */
export function ScheduleDateControl({
  ariaLabel,
  value,
  canEdit,
  quick = [],
  onChange,
}: {
  ariaLabel: string
  value: string | null
  canEdit: boolean
  quick?: Array<{ label: string; days: number }>
  onChange: (day: string | null) => void
}) {
  // ⚠️ Held locally so a half-typed date does not round-trip on every keystroke, and re-seeded whenever
  // the issue is re-read — an edit made in another tab has to land here rather than being overwritten by
  // whatever this component last remembered.
  const [draft, setDraft] = useState(value ?? "")
  const lastValue = useRef(value)

  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value
      setDraft(value ?? "")
    }
  }, [value])

  if (!canEdit) {
    return (
      <div className="min-w-0 px-2 text-sm">
        {value ? formatDay(value) : <span className="text-muted-foreground">—</span>}
      </div>
    )
  }

  function commit(day: string) {
    setDraft(day)
    onChange(day === "" ? null : day)
  }

  return (
    // ⚠️ Stacked, not one line. The rail is about 230px wide with 76 of them spent on the label, and a
    // native date input needs most of what is left — two buttons beside it clipped the field to
    // "mm/dd" with the year off the edge. A second line costs 28px on one row of the rail.
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <input
          type="date"
          aria-label={ariaLabel}
          value={draft}
          onChange={(event) => commit(event.target.value)}
          className={cn(
            "h-7 min-w-0 flex-1 rounded border border-input bg-transparent px-1.5 text-xs",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        />

        {/* ⚠️ Only where there is something to clear. A permanently-present × on an empty field is a
            control that does nothing, and a reader has to try it once to find that out. */}
        {value && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 shrink-0"
            aria-label={`Clear ${ariaLabel.toLowerCase()}`}
            onClick={() => commit("")}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {quick.map((shortcut) => {
            const day = dayOffsetFromToday(shortcut.days)
            const chosen = value === day

            return (
              <Button
                key={shortcut.label}
                type="button"
                size="sm"
                variant={chosen ? "default" : "outline"}
                className="h-6 flex-1 px-2 text-xs"
                aria-pressed={chosen}
                onClick={() => commit(chosen ? "" : day)}
              >
                {shortcut.label}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}

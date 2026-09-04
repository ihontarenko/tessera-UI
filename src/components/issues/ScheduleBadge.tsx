import { AlarmClockIcon, CalendarClockIcon, CalendarIcon, FlagIcon, TriangleAlertIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { IssueSchedule, ScheduleState } from "@/api/issues"
import { cn } from "@/lib/helpers"

/**
 * When an issue is meant to happen, as one small mark.
 *
 * <h2>⚠️ Painted from `state`, never from the dates</h2>
 *
 * The server decides which of the three dates wins today and answers with a word; this file is a lookup
 * on that word. Comparing dates here would be a second derivation of the same rule, and the way that
 * drift shows is a card painted amber beside a filter calling the same issue overdue — both plausible,
 * one wrong, and nothing on screen to say which.
 *
 * <h2>⚠️ Three degrees of alarm, and they are deliberately not three shades of red</h2>
 *
 * A queue date is a plan somebody made for themselves and is drawn as calmly as any other property. A
 * red line is a warning and is amber. A deadline that is here or past is red. Painting the queue red
 * too would make the pile somebody chose to work on today look like a problem, and then nothing would
 * be left to say when one actually appeared.
 *
 * ⚠️ **The colour is never the only signal.** Each state carries its own icon and its own words, so it
 * survives a monochrome screen and a reader who cannot tell amber from red.
 */
interface ScheduleStyle {
  icon: LucideIcon
  /** Deliberately a token pair per state rather than one hue ramp — see the note above. */
  className: string
}

const STYLES: Record<Exclude<ScheduleState, "NONE">, ScheduleStyle> = {
  SCHEDULED: {
    icon: CalendarIcon,
    className: "bg-muted text-muted-foreground",
  },
  QUEUED: {
    icon: CalendarClockIcon,
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  RED_LINE: {
    icon: TriangleAlertIcon,
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  DUE_TODAY: {
    icon: AlarmClockIcon,
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  OVERDUE: {
    icon: FlagIcon,
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
}

const PILL_SHAPE =
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide"

/**
 * The badge, or nothing at all where no date has been set.
 *
 * @param schedule the issue's schedule, exactly as the server sent it
 * @param compact  drop the wording and keep the icon — for a board card, where the row is already
 *                 carrying a key, an avatar and a priority mark
 */
export function ScheduleBadge({
  schedule,
  compact = false,
  className,
}: {
  schedule: IssueSchedule | null | undefined
  compact?: boolean
  className?: string
}) {
  if (!schedule || schedule.state === "NONE") {
    return null
  }

  const style = STYLES[schedule.state]
  const Icon = style.icon
  const label = scheduleLabel(schedule)

  return (
    <span className={cn(PILL_SHAPE, style.className, className)} title={scheduleTitle(schedule)}>
      <Icon className="size-3" aria-hidden="true" />
      {/* ⚠️ The words stay in the accessible tree even when the badge is drawn as an icon alone. A mark
          whose whole meaning is its colour is a mark a screen reader cannot report at all. */}
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </span>
  )
}

/**
 * What the badge says, in the fewest words that are still true.
 *
 * ⚠️ **Relative wording only near today.** "Tomorrow" and "in 3 days" are how somebody actually thinks
 * about the next week; past that, a relative count stops helping and a date is what they want to see.
 */
function scheduleLabel(schedule: IssueSchedule): string {
  if (schedule.state === "OVERDUE") {
    const daysLate = Math.abs(schedule.daysUntilDeadline ?? 0)

    return daysLate === 1 ? "1 day late" : `${daysLate} days late`
  }

  if (schedule.state === "DUE_TODAY") {
    return "Due today"
  }

  if (schedule.state === "RED_LINE") {
    return schedule.deadline ? `Due ${relativeDay(schedule.daysUntilDeadline)}` : "Red line"
  }

  if (schedule.state === "QUEUED") {
    return "Up next"
  }

  return `Queued ${formatDay(schedule.queuedFor ?? schedule.redLine ?? schedule.deadline)}`
}

/** Everything the badge knows, for the reader who hovers because the one word was not enough. */
function scheduleTitle(schedule: IssueSchedule): string {
  const parts: string[] = []

  if (schedule.queuedFor) {
    parts.push(`Queued for ${schedule.queuedFor}`)
  }
  if (schedule.redLine) {
    parts.push(`Red line ${schedule.redLine}`)
  }
  if (schedule.deadline) {
    parts.push(`Deadline ${schedule.deadline}`)
  }

  return parts.join(" · ")
}

/** "today", "tomorrow", "in 4 days" — and a plain count once relative stops being useful. */
function relativeDay(days: number | null): string {
  if (days === null) {
    return "soon"
  }
  if (days <= 0) {
    return "today"
  }
  if (days === 1) {
    return "tomorrow"
  }

  return `in ${days} days`
}

/** A stored `YYYY-MM-DD` as a person reads it, in their own locale. */
export function formatDay(day: string | null | undefined): string {
  if (!day) {
    return "—"
  }

  const parsed = new Date(`${day}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return day
  }

  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

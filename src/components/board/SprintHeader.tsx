import { CalendarClock, FlagTriangleRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/context/LanguageContext"
import type { ActiveSprintView } from "@/api/sprints"
import { cn } from "@/lib/helpers"

/**
 * The running sprint's context above the board (Phase-3 tickets 04/05) — what the team signed up for,
 * how long is left of it, and the action that ends it. Everything here rides on the board payload, so
 * the header costs no second request.
 *
 * `daysRemaining` is signed: a sprint past its end date says so in the destructive colour rather than
 * quietly showing zero, because a sprint that has run over is exactly the thing a board should surface.
 *
 * Completing lives here rather than in settings for the same reason the header does: closing a sprint
 * is a decision about the work, taken while looking at it.
 */
export function SprintHeader({ sprint, onComplete }: { sprint: ActiveSprintView; onComplete?: () => void }) {
  const { t } = useLanguage()
  const daysRemaining = sprint.daysRemaining
  const isOverdue = daysRemaining !== null && daysRemaining !== undefined && daysRemaining < 0

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2">
      <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-display text-sm font-semibold tracking-[-0.01em]">{sprint.name}</span>

      {sprint.goal ? <span className="truncate text-xs italic text-muted-foreground">{sprint.goal}</span> : null}

      <span className="ml-auto flex shrink-0 items-center gap-2">
        {daysRemaining !== null && daysRemaining !== undefined && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs tabular-nums",
              isOverdue ? "bg-destructive/15 text-destructive" : "bg-background text-muted-foreground",
            )}
          >
            {isOverdue
              ? t("sprint.header.overdue", "{days} days over", { days: Math.abs(daysRemaining) })
              : t("sprint.header.daysRemaining", "{days} days remaining", { days: daysRemaining })}
          </span>
        )}

        {onComplete && (
          <Button size="sm" variant="outline" onClick={onComplete}>
            <FlagTriangleRight className="mr-1.5 size-3.5" /> {t("sprint.complete.action", "Complete sprint")}
          </Button>
        )}
      </span>
    </div>
  )
}

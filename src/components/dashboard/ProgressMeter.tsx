import { Tooltip, TooltipContent, TooltipTrigger } from "@jmouse/ui"
import type { ProjectProgress } from "@/api/dashboard"
import { useLanguage } from "@/context/LanguageContext"
import { CATEGORY_COLOR } from "@/components/dashboard/statusPalette"

/**
 * One project as a single bar in three parts: not started, in flight, finished.
 *
 * ⚠️ **A proportional meter, not a chart.** There is one quantity split three ways and no axis worth
 * drawing — the whole question is *what share*, which a bar answers at a glance and a pie answers
 * worse. It is the form the dataviz skill calls a meter, and it belongs inline in the card it describes
 * rather than in a plot of its own.
 *
 * ⚠️ **The order is fixed and is never a sort by size.** To Do → In Progress → Done is the direction
 * work travels, so the eye reads progress left to right; reordering by magnitude would make two
 * projects with the same numbers draw differently and destroy that reading.
 *
 * ⚠️ **A 2px surface gap separates the fills**, so adjacent segments stay two marks rather than one
 * gradient — the same spacer rule as stacked bars. It is drawn with `gap` on the flex row rather than
 * with a border, so it is the page's own surface showing through and stays correct in both themes.
 *
 * ⚠️ **Identity is never colour alone.** Every segment carries its count and its name in the tooltip,
 * and the card beneath spells the three numbers out; the hue only makes them findable.
 */
export function ProgressMeter({ progress }: { progress: ProjectProgress }) {
  const { t } = useLanguage()

  const total = progress.todo + progress.inProgress + progress.done

  const segments = [
    { key: "TODO" as const, label: t("dashboard.progress.todo", "To do"), value: progress.todo },
    { key: "IN_PROGRESS" as const, label: t("dashboard.progress.inProgress", "In progress"), value: progress.inProgress },
    { key: "DONE" as const, label: t("dashboard.progress.done", "Done"), value: progress.done },
  ]

  // ⚠️ An empty project draws the track and nothing in it. A meter that disappeared would make a new
  // project look like a rendering fault on the one day somebody is most likely to be looking at it.
  if (total === 0) {
    return (
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-full bg-muted" />
        <p className="text-[11px] text-muted-foreground">
          {t("dashboard.progress.empty", "No issues yet")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <Tooltip key={segment.key}>
              <TooltipTrigger asChild>
                {/* The rounding is on the row, so only the outer ends round — an inner segment with
                    rounded ends would read as a separate pill rather than as part of one bar. */}
                <div
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(segment.value / total) * 100}%`,
                    backgroundColor: CATEGORY_COLOR[segment.key],
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {segment.label}: {segment.value}
              </TooltipContent>
            </Tooltip>
          ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
        {segments.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: CATEGORY_COLOR[segment.key] }}
            />
            {segment.label} {segment.value}
          </span>
        ))}
      </p>
    </div>
  )
}

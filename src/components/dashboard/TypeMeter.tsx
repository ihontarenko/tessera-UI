import { Tooltip, TooltipContent, TooltipTrigger } from "@jmouse/ui"
import type { TypeStanding } from "@/api/dashboard"
import { issueTypeInkClass } from "@/components/issues/issueVisuals"
import { useLanguage } from "@/context/LanguageContext"

/**
 * How many kinds the meter names before the tail folds into one segment.
 *
 * ⚠️ **Eight, where the ranked-row version this replaced folded at six**, and the difference is the
 * form rather than a change of mind. Six rows was a height budget; here the constraint is a legend that
 * wraps under a full-width bar, which takes eight comfortably. Past that the card stops being a glance.
 */
const VISIBLE_KINDS = 8

/**
 * What the open work is made of — one bar, one segment per kind.
 *
 * ⚠️ **A meter, not a chart, and that is the correction this file records.** It was ranked rows: label,
 * proportional bar, number, each row scaled against the largest. That is the right form for a *ranking*
 * — which is what `StatusBarChart` draws, and what movement and standing genuinely are. These counts
 * are something else: they are a **partition**. Every open issue is of exactly one kind, so the rows
 * sum to `openTotal`, and the question worth asking is *what share* rather than *which is biggest*. A
 * partition drawn as a ranking throws the sum away — seven bars each measured against the longest say
 * nothing about how much of the whole any of them is.
 *
 * ⚠️ **The same form `ProgressMeter` uses, deliberately.** A project's three status buckets are the
 * same shape of fact — one quantity split several ways — and drawing them alike is what lets somebody
 * read this card without being taught it. The 2px gaps between fills, the rounding on the row rather
 * than the segments, and the dotted legend beneath are all that component's rules, kept.
 *
 * ⚠️ **Ordered by size, where `ProgressMeter` is deliberately not.** That meter fixes To Do → In
 * Progress → Done because it draws a *direction* work travels, and reordering it by magnitude would
 * destroy the reading. Kinds have no direction, so the useful order is the informative one — biggest
 * first, which is the order the server already sorts them in.
 *
 * ⚠️ **A kind is never identified by hue alone.** Every segment carries its name and count in a
 * tooltip, and the legend beneath spells all of them out — the colour only makes a segment findable.
 * That matters more here than on a three-part meter: nine hues is past what anybody matches by memory.
 *
 * ⚠️ **The colour comes from the type's own text class via `bg-current`**, so the hue is read from the
 * one list that already decides what a Bug looks like. A second colour table beside the icon's is
 * exactly the thing that drifts.
 */
export function TypeMeter({ rows, total }: { rows: TypeStanding[]; total: number }) {
  const { t } = useLanguage()

  // ⚠️ The cap only bites when it would fold at least TWO kinds. Folding a single one hides a name to
  // save nothing — the segment is the same width either way, the legend gains no room, and the row
  // reads "1 other kinds 1", which is both worse and ungrammatical. The cap exists to bound a long
  // tail, not to round the list down to a number.
  const folds = rows.length > VISIBLE_KINDS + 1

  const shown = folds ? rows.slice(0, VISIBLE_KINDS) : rows
  const folded = folds ? rows.slice(VISIBLE_KINDS) : []

  const segments = [
    ...shown.map((row) => ({ label: row.type, value: row.count, iconKey: row.iconKey })),
    ...(folded.length > 0
      ? [
          {
            label: t("dashboard.byType.other", "{count} other kinds").replace(
              "{count}",
              String(folded.length),
            ),
            value: folded.reduce((sum, row) => sum + row.count, 0),
            // ⚠️ No icon key, so it draws in muted ink — which is the truth: this segment is several
            // kinds at once and has no colour of its own to wear.
            iconKey: null,
          },
        ]
      : []),
  ]

  // ⚠️ The segments are shares of the reported total rather than of their own sum, so the bar is short
  // of full whenever the tail was folded away with a cap — it cannot silently redistribute what it is
  // not showing. With no cap in play the two are the same number.
  const whole = Math.max(total, 1)

  return (
    <div className="space-y-2 py-3">
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <Tooltip key={segment.label}>
              <TooltipTrigger asChild>
                {/* The rounding is on the row, so only the outer ends round — an inner segment with
                    rounded ends would read as a separate pill rather than as part of one bar. */}
                <div
                  className={`h-full bg-current first:rounded-l-full last:rounded-r-full ${issueTypeInkClass(segment.iconKey)}`}
                  style={{ width: `${(segment.value / whole) * 100}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {segment.label}: {segment.value}
              </TooltipContent>
            </Tooltip>
          ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
        {segments.map((segment) => (
          <span key={segment.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`size-1.5 shrink-0 rounded-full bg-current ${issueTypeInkClass(segment.iconKey)}`}
            />
            <span className="text-foreground">{segment.label}</span> {segment.value}
          </span>
        ))}
      </p>
    </div>
  )
}

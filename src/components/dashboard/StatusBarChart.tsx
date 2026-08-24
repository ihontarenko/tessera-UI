import type { StatusCategory } from "@/api/dashboard"
import { useLanguage } from "@/context/LanguageContext"
import { categoryColor } from "@/components/dashboard/statusPalette"

/**
 * How many rows a card carries before the tail folds into one honest row.
 *
 * ⚠️ **A default, not a rule** — the two cards on the dashboard want different answers. Movement is
 * unbounded (every status the log ever recorded a move into, including renamed ones) and needs the
 * fold; standing is bounded by the catalogue and reports zeros on purpose, so folding would throw away
 * exactly the rows that were asked for.
 */
const VISIBLE_ROWS = 6

export interface StatusBar {
  status: string
  category: StatusCategory | null
  count: number
}

/**
 * One number per status — whatever the number happens to mean.
 *
 * ⚠️ **The chart does not know whether it is drawing movement or standing, and that is deliberate.**
 * The dashboard asks both questions — *"what entered review this week"* and *"what is in review right
 * now"* — and they are genuinely different facts that a busy week ending where it started tells apart.
 * What they are not is different pictures: same rows, same hues, same fold. Two files would have been
 * one file typed twice, and the second copy is where they quietly drift apart.
 *
 * ⚠️ **Markup and CSS, not a charting library, and that is a correction rather than a shortcut.** This
 * was a recharts `BarChart` — and under recharts 3 the value labels silently stopped rendering: neither
 * a nested `<LabelList>` nor the `label` prop produces a node when the bars carry `<Cell>` children.
 * No error, no warning, just bars with no numbers on them, which is how it survived unnoticed. What
 * this chart actually is — a label, a proportional bar and a number, laid out in rows — is a list, and
 * a list drawn as a list cannot lose its numbers to a library upgrade. Nothing here needs an axis, a
 * scale, a legend or a tooltip: the value is already written beside every bar. The one chart on this
 * screen that genuinely needs those, `FlowChart`, keeps them.
 *
 * ⚠️ **Horizontal, because the labels are words.** Status names are arbitrary-length text, and a
 * vertical bar chart would either rotate them or truncate them — rotated axis labels are the thing
 * everybody squints at. Laid out this way each name reads straight.
 *
 * ⚠️ **Colour follows the status CATEGORY, not the rank.** A bar keeps its hue when the ordering
 * changes, and two statuses in the same category share one — which is the true statement: they are the
 * same kind of work. Because several bars can therefore be one colour, the value is written beside
 * every one of them, so nothing here is identified by hue alone.
 *
 * ⚠️ **Nothing is silently dropped.** Past `maxRows` the tail folds into one "other" row that says how
 * many statuses it stands for — a truncated list reads as a complete one.
 *
 * ⚠️ **A zero is a row with a number and no bar.** Whether an empty status belongs in the picture is
 * the caller's decision — "nothing is in review" is worth saying, "nobody moved anything into review"
 * mostly is not — so the rows arrive already decided. What this component guarantees is that an empty
 * one still reads as empty rather than as broken, which takes the number: a row with neither a bar nor
 * a figure beside it is indistinguishable from one that failed to render.
 */
export function StatusBarChart({
  rows,
  label,
  maxRows = VISIBLE_ROWS,
}: {
  rows: StatusBar[]
  label: string
  /** How many bars before the tail folds. Raise it where the rows are bounded and all of them matter. */
  maxRows?: number
}) {
  const { t } = useLanguage()

  const head = rows.slice(0, maxRows)
  const tail = rows.slice(maxRows)

  const drawn = tail.length
    ? [
        ...head,
        {
          status: t("dashboard.statusChart.other", "{count} more statuses").replace(
            "{count}",
            String(tail.length),
          ),
          category: null,
          count: tail.reduce((running, row) => running + row.count, 0),
        } satisfies StatusBar,
      ]
    : head

  // ⚠️ At least 1, so a card where everything is zero divides by something and draws no bars, rather
  // than dividing by zero and drawing NaN-wide ones.
  const largest = Math.max(1, ...drawn.map((row) => row.count))

  return (
    <ul className="flex flex-col gap-1.5" aria-label={label}>
      {drawn.map((row) => (
        <li key={row.status} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
          <span className="truncate text-right text-xs text-muted-foreground" title={row.status}>
            {row.status}
          </span>

          <span className="flex min-w-0 items-center gap-1.5">
            {/* ⚠️ The track carries the width; the bar fills it. Percentages against a flexing column
                need something to be a percentage OF, and the number must not be pushed off the right
                edge by a full-length bar — so it sits outside the track rather than after the fill. */}
            <span className="h-3.5 min-w-0 flex-1">
              <span
                className="block h-full rounded-r-sm"
                style={{
                  width: `${(row.count / largest) * 100}%`,
                  backgroundColor: categoryColor(row.category),
                }}
              />
            </span>

            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{row.count}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

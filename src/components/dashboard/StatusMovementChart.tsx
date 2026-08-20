import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@jmouse/ui"
import type { StatusMovement } from "@/api/dashboard"
import { useLanguage } from "@/context/LanguageContext"
import { CATEGORY_COLOR, categoryColor } from "@/components/dashboard/statusPalette"

/** Beyond this the bars are thinner than their labels; the rest folds into one honest row. */
const VISIBLE_ROWS = 6

/**
 * Which statuses issues moved **into** during the window, busiest first.
 *
 * ⚠️ **Movement, not standing.** "Nine entered review this week" is a fact about the week; "nine are in
 * review" is a fact about right now, and the board already shows that one. They are different charts
 * and this is the first.
 *
 * ⚠️ **Horizontal bars, because the labels are words.** Status names are arbitrary-length text — a
 * vertical bar chart would either rotate them or truncate them, and rotated axis labels are the thing
 * everybody squints at. Laid out this way each name reads straight.
 *
 * ⚠️ **Colour follows the status CATEGORY, not the rank.** A bar keeps its hue when the ordering
 * changes, and two statuses in the same category share one — which is the true statement: they are the
 * same kind of movement. Because several bars can therefore be one colour, the value is direct-labelled
 * on every bar and the name sits on the axis, so nothing here is identified by hue alone.
 *
 * ⚠️ **Nothing is silently dropped.** Past {@link VISIBLE_ROWS} the tail is folded into one "other"
 * row that says how many statuses it stands for — a truncated list reads as a complete one.
 */
export function StatusMovementChart({ movements }: { movements: StatusMovement[] }) {
  const { t } = useLanguage()

  const head = movements.slice(0, VISIBLE_ROWS)
  const tail = movements.slice(VISIBLE_ROWS)

  const rows = tail.length
    ? [
        ...head,
        {
          status: t("dashboard.movement.other", "{count} more statuses").replace(
            "{count}",
            String(tail.length),
          ),
          category: null,
          count: tail.reduce((running, movement) => running + movement.count, 0),
        } satisfies StatusMovement,
      ]
    : head

  const configuration: ChartConfig = {
    count: { label: t("dashboard.movement.label", "Moved into"), color: CATEGORY_COLOR.IN_PROGRESS },
  }

  return (
    <ChartContainer config={configuration} className="aspect-auto h-40 w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 28, top: 4, bottom: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="status"
          tickLine={false}
          axisLine={false}
          width={104}
          tickMargin={6}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />

        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
          {rows.map((movement) => (
            <Cell key={movement.status} fill={categoryColor(movement.category)} />
          ))}
          {/* The direct label is the secondary encoding that lets two same-category bars share a hue. */}
          <LabelList
            dataKey="count"
            position="right"
            className="fill-muted-foreground text-[11px] tabular-nums"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

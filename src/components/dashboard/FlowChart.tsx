import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@jmouse/ui"
import type { FlowPoint } from "@/api/dashboard"
import { useLanguage } from "@/context/LanguageContext"

/**
 * Raised against resolved, day by day — the only chart on this screen that can say whether the backlog
 * is growing.
 *
 * ⚠️ **Two series on ONE axis.** Both are counts of issues, so they are directly comparable and belong
 * on the same scale; that comparison is the entire content of the chart. The day somebody wants a
 * measure in different units on here — hours, points, people — it becomes a second chart rather than a
 * second y-axis, because two scales on one plot make the lines cross wherever the author chose and the
 * reader cannot tell.
 *
 * ⚠️ **Bars, not lines.** These are counts of separate events per day, not a quantity that existed
 * between the days — a line would draw an interpolation across midnight that never happened. The
 * burndown is a line for exactly the opposite reason.
 *
 * ⚠️ **Days with nothing are zeros, not gaps** (`DashboardService.flow` fills them). A series built
 * only from days that had activity draws a quiet week and a busy one identically.
 *
 * Colours are the ramp in its documented order (`--chart-5`, then `--chart-4`) — adjacent in that order,
 * and validated as a pair in both modes (worst ΔE 19.7 light / 23.0 dark). They sit deliberately outside
 * the three hues this screen reserves for status categories: "raised" and "resolved" are events, not
 * states, and reusing the category green for "resolved" would make one hue mean two things one card
 * apart.
 *
 * ⚠️ `--chart-4` is 2.8:1 against the light surface, under the 3:1 floor. That is a WARN the validator
 * does not let you dismiss — it obliges visible labels — which is why the legend is always present and
 * the y-axis carries values: the series is identified in text ink beside its swatch, never by asking the
 * eye to separate a fill from the paper behind it.
 */
export function FlowChart({ series }: { series: FlowPoint[] }) {
  const { t } = useLanguage()

  const configuration = useMemo<ChartConfig>(
    () => ({
      created: { label: t("dashboard.flow.created", "Raised"), color: "var(--chart-5)" },
      resolved: { label: t("dashboard.flow.resolved", "Resolved"), color: "var(--chart-4)" },
    }),
    [t],
  )

  return (
    <ChartContainer config={configuration} className="aspect-auto h-40 w-full">
      <BarChart data={series} barGap={2} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={8}
          tickFormatter={(value: string) => format(parseISO(value), "d MMM")}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => format(parseISO(String(value)), "EEEE, d MMMM")}
              indicator="dashed"
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />

        {/* 4px rounded ends on the data end only, anchored to the baseline. */}
        <Bar dataKey="created" fill="var(--color-created)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="resolved" fill="var(--color-resolved)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

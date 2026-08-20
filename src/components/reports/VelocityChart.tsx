import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@jmouse/ui"
import { useLanguage } from "@/context/LanguageContext"
import type { Translate } from "@/lib/translatableText"
import type { VelocityPoint } from "@/api/reports"

/**
 * Velocity (Phase-3 ticket 07): committed against completed for each closed sprint, side by side and
 * oldest to newest, so what the team actually delivers per sprint is a shape rather than a feeling —
 * and chronic over-commitment is a run of short right-hand bars rather than something someone has to
 * remember.
 *
 * Grouped bars, not stacked: the two totals are alternative measures of the same sprint, and stacking
 * them would draw a sum that means nothing. One axis, because both are story points.
 *
 * Colours are the design system's categorical ramp taken in its documented order (`--chart-1`, then
 * `--chart-3` — the order that clears the adjacent-CVD check, not the numeric one), the same pair the
 * burndown uses. Identity is never colour-alone: the legend is always present and the tooltip names
 * both series.
 */
export function VelocityChart({ velocity }: { velocity: VelocityPoint[] }) {
  const { t } = useLanguage()

  const configuration = useMemo<ChartConfig>(
    () => ({
      committedPoints: { label: t("velocity.committed", "Committed"), color: "var(--chart-1)" },
      completedPoints: { label: t("velocity.completed", "Completed"), color: "var(--chart-3)" },
    }),
    [t],
  )

  return (
    <ChartContainer config={configuration} className="aspect-auto h-72 w-full">
      <BarChart data={velocity} barGap={2} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="sprintName" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_label, payload) => issueTally(t, payload)}
              indicator="dashed"
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />

        <Bar dataKey="committedPoints" fill="var(--color-committedPoints)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="completedPoints" fill="var(--color-completedPoints)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

/**
 * The tooltip heads with the sprint and how its issues went, so the bars can stay purely about points
 * without the issue counts — which the retrospective also asks for — going unsaid.
 */
function issueTally(
  translate: Translate,
  payload: readonly { payload?: VelocityPoint }[] | undefined,
): string {
  const point = payload?.[0]?.payload

  if (!point) {
    return ""
  }

  return translate("velocity.tooltip.issues", "{sprint} · {completed} of {committed} issues completed", {
    sprint: point.sprintName,
    completed: point.completedIssues,
    committed: point.committedIssues,
  })
}

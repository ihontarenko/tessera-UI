import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@jmouse/ui"
import { useLanguage } from "@/context/LanguageContext"
import type { BurndownPoint } from "@/api/reports"

/**
 * The sprint's burndown (Phase-3 ticket 06), derived on read from membership rows and resolution
 * timestamps — never from a snapshot table (ADR-0013), which is why it has no holes on the days nobody
 * was at the machine.
 *
 * Three lines, one axis (all three are story points — a second y-scale would make them comparable by
 * accident rather than by fact):
 *
 * - **Remaining** — the real line, and the only one the eye should land on first. It stops where the
 *   sprint stopped: `remaining` is null for days the sprint never reached, and `connectNulls` is off, so
 *   an early close draws a short line against a full axis rather than a flat tail that would read as a
 *   team that gave up.
 * - **Scope** — what was committed that day. Drawn separately precisely so that a sprint that *grew* is
 *   visibly a different thing from a team that slowed down.
 * - **Ideal** — a reference, so it is drawn as a recessive dashed line in muted ink rather than given a
 *   categorical hue. It is not a third thing that happened; it is the ruler.
 *
 * Colours are the design system's categorical ramp taken in its documented order (`--chart-1`, then
 * `--chart-3`), which is the order that clears the adjacent-CVD check — not the numeric order.
 */
export function BurndownChart({ burndown }: { burndown: BurndownPoint[] }) {
  const { t } = useLanguage()

  const configuration = useMemo<ChartConfig>(
    () => ({
      remaining: { label: t("report.burndown.remaining", "Remaining"), color: "var(--chart-1)" },
      scope: { label: t("report.burndown.scope", "Scope"), color: "var(--chart-3)" },
      ideal: { label: t("report.burndown.ideal", "Ideal"), color: "var(--muted-foreground)" },
    }),
    [t],
  )

  return (
    <ChartContainer config={configuration} className="aspect-auto h-72 w-full">
      <LineChart data={burndown} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(date: string) => format(parseISO(date), "d MMM")}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent labelFormatter={(_label, payload) => formatTooltipDate(payload)} />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />

        <Line
          dataKey="ideal"
          type="linear"
          stroke="var(--color-ideal)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          activeDot={false}
        />
        <Line dataKey="scope" type="stepAfter" stroke="var(--color-scope)" strokeWidth={2} dot={false} />
        <Line
          dataKey="remaining"
          type="linear"
          stroke="var(--color-remaining)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

/** The tooltip heads with the full date; the axis only has room for "5 Mar". */
function formatTooltipDate(payload: readonly { payload?: BurndownPoint }[] | undefined): string {
  const date = payload?.[0]?.payload?.date

  return date ? format(parseISO(date), "EEEE d MMMM") : ""
}

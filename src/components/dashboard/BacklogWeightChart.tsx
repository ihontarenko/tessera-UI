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
import type { WeightPoint } from "@/api/dashboard"
import { useLanguage } from "@/context/LanguageContext"

/**
 * The week weighed rather than counted — two lines, estimate opened against estimate closed.
 *
 * ⚠️ **The gap between the lines is the content, and it is the whole reason this card exists.** It
 * replaced a cumulative delivered-only area, which *only ever went up*: with nothing to compare it
 * against, a good week and a bad one differed by a slope nobody reads. Here the reference is on the
 * plot — wherever Raised runs above Delivered the backlog gained weight that day, and wherever it runs
 * below it lost some. Neither line alone says anything of the kind.
 *
 * ⚠️ **Two lines on ONE axis, which is legal here and is not on the flow chart.** Both series are
 * points, so they are directly comparable and the crossings mean what they look like. `FlowChart`
 * refuses a points series for exactly the mirror-image reason: a count and a weight on one scale cross
 * wherever the author put the axis.
 *
 * ⚠️ **Lines rather than bars, and that is a deliberate exception.** These are per-day events, and the
 * flow chart draws them as bars precisely because a line interpolates across a midnight nothing
 * happened at. Here the reader's question is not "how much on Tuesday" but "which one is on top", and
 * two lines answer it at a glance where fourteen bars have to be paired up and compared by eye. The
 * segments between the days are a reading aid, not a claim about those hours — which is why they are
 * `linear` and never `monotone`: a fitted curve bulges between the points and would put delivery at
 * hours nothing was resolved.
 *
 * ⚠️ **The axis starts at zero and stops on a round number.** A line chart whose axis floats to fit
 * the data exaggerates every wobble into a mountain; and an axis that ends on the data has no round
 * number anywhere on it — `[0, 417]` gave ticks reading 104, 208, 313, 417.
 *
 * ⚠️ **Both lines under-report, always** — an issue nobody estimated adds to neither. That is honest
 * arithmetic and also a trap, so the card is obliged to print what fraction of the week it could weigh
 * at all. Read this chart with that number, never without it.
 *
 * Colours are the two the flow chart already uses for the same two events (`--chart-5` raised,
 * `--chart-4` resolved), because this card is that card in different units. A separate hue would claim
 * they were unrelated facts. `--chart-4` sits at 2.8:1 against the light surface, under the 3:1 floor,
 * which obliges the series to be named in ink rather than by colour alone — hence the always-present
 * legend, exactly as on the flow chart.
 */
export function BacklogWeightChart({ series }: { series: WeightPoint[] }) {
  const { t } = useLanguage()

  const configuration = useMemo<ChartConfig>(
    () => ({
      raised: { label: t("dashboard.weight.raised", "Raised"), color: "var(--chart-5)" },
      delivered: { label: t("dashboard.weight.delivered", "Delivered"), color: "var(--chart-4)" },
    }),
    [t],
  )

  const reach = useMemo(
    () => niceReach(Math.max(0, ...series.map((point) => Math.max(point.raised, point.delivered)))),
    [series],
  )

  return (
    <ChartContainer config={configuration} className="aspect-auto h-40 w-full">
      <LineChart data={series} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={8}
          tickFormatter={(value: string) => format(parseISO(value), "d MMM")}
        />
        {/* ⚠️ `interval={0}` because recharts silently drops a tick it judges too close to its
            neighbour — asking for these three in a 160px card otherwise yields two, and the axis comes
            out lopsided with a gap where a label belongs. */}
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={36}
          domain={[0, reach]}
          ticks={[0, reach / 2, reach]}
          interval={0}
          tickFormatter={formatAxisPoints}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => format(parseISO(String(value)), "EEEE, d MMMM")}
              indicator="line"
            />
          }
        />
        {/* ⚠️ Sorted explicitly: recharts orders the legend ALPHABETICALLY, which puts Delivered first
            and reverses the pairing every other card on this screen reads in. */}
        <ChartLegend
          content={<ChartLegendContent />}
          itemSorter={(item) => (item.dataKey === "raised" ? 0 : 1)}
        />

        <Line
          dataKey="raised"
          type="linear"
          stroke="var(--color-raised)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          dataKey="delivered"
          type="linear"
          stroke="var(--color-delivered)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  )
}

/**
 * An estimate total as a person reads it.
 *
 * ⚠️ **The number, never the scheme's label.** These figures are summed across every project the member
 * can browse, and two projects may estimate on different scales — a total of `8` is not one project's
 * `XL`, so `formatStoryPoints` would print a word that means nothing here. Halves survive because
 * Fibonacci teams use them; a whole number never prints its `.0`.
 */
export function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

/**
 * The same figure with a sign in front, for the headline.
 *
 * ⚠️ **A plus sign on a positive number is not decoration here.** The headline is a *change*, and
 * `18` reads as an amount while `+18` reads as a direction — which is the only thing the number is for.
 * Zero gets neither sign.
 */
export function formatSignedPoints(points: number): string {
  if (points > 0) {
    return `+${formatPoints(points)}`
  }

  // ⚠️ A real minus sign, not a hyphen: at the headline's size the hyphen is a hairline that reads as
  // dirt on the screen.
  if (points < 0) {
    return `−${formatPoints(Math.abs(points))}`
  }

  return "0"
}

/**
 * The same number with only as many characters as an axis tick can afford.
 *
 * ⚠️ **Abbreviated on the axis and never in the tooltip.** The axis exists to give the shape a scale,
 * where `1.4k` is as useful as `1400` and four glyphs narrower; the tooltip is where somebody reads an
 * actual figure, and rounding one there would be answering a precise question imprecisely.
 */
function formatAxisPoints(points: number): string {
  if (points < 1000) {
    return formatPoints(points)
  }

  return `${(points / 1000).toFixed(1).replace(/\.0$/, "")}k`
}

/** The rungs a rounded axis is allowed to stop on, within each decade. */
const NICE_STEPS = [1, 2, 4, 5, 10]

/**
 * The busiest day rounded up to a number somebody would have chosen.
 *
 * ⚠️ **An axis that ends on the data is an axis with no round numbers on it.** `[0, 417]` is a truthful
 * domain and a useless scale: every tick under it is a quotient of 417. Rounding up to the next rung of
 * the decade gives 500, whose half is 250, and the chart reads as a measurement instead of an
 * arithmetic exercise. The rungs stop at 5× rather than continuing to 9× so that a busy day never ends
 * up drawn against an axis twice its height.
 */
function niceReach(maximum: number): number {
  if (maximum <= 0) {
    return 1
  }

  const decade = 10 ** Math.floor(Math.log10(maximum))
  const rung = NICE_STEPS.find((step) => step * decade >= maximum)

  return (rung ?? 10) * decade
}

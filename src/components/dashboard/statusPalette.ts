import type { StatusCategory } from "@/api/dashboard"

/**
 * The one colour language for the three status categories, used by every mark on the dashboard.
 *
 * ⚠️ **Three slots from the design system's categorical ramp, taken in its documented order** —
 * `--chart-1`, `--chart-3`, `--chart-2` — which is the order that clears the adjacent-CVD check, not
 * the numeric one (see the comment above the ramp in `index.css`). The set was run through the dataviz
 * skill's `validate_palette.js` in both modes and passes all five checks: lightness band, chroma floor,
 * CVD separation (worst adjacent ΔE 15.7 light / 17.6 dark), the normal-vision floor, and contrast
 * against the light and dark surfaces.
 *
 * ⚠️ **A neutral grey for "To Do" was tried first and is a hard FAIL**, not a matter of taste. Both
 * candidates — `--ink-4` and `--muted-foreground` — sit below the chroma floor, and the darker one is
 * ΔE 10.9 from `--chart-3` for a reader with *normal* colour vision: in a 6px meter segment, grey and
 * blue are simply not distinguishable, and secondary encoding does not excuse that one.
 *
 * The two hues that carry meaning elsewhere keep it here: green is done and blue is in flight, exactly
 * as `StatusPill` paints them, so the meter and the pill never disagree. Amber is the third slot rather
 * than a warning — nothing on this screen uses the reserved status palette.
 *
 * ⚠️ **Colour is never the only encoding.** Every consumer ships a label, a legend or a tooltip beside
 * the mark; a segment identified by hue alone would fail the accessibility pass however well the
 * palette validates.
 */
export const CATEGORY_COLOR: Record<StatusCategory, string> = {
  DONE: "var(--chart-1)",
  IN_PROGRESS: "var(--chart-3)",
  TODO: "var(--chart-2)",
}

/**
 * What a status whose category is unknown is drawn in.
 *
 * ⚠️ Its own value rather than a fourth category. A status the catalogue no longer holds still has real
 * moves recorded against it, and dropping them would report a quieter week than happened — so it is
 * drawn recessively and named in full, which says "this happened, and I cannot tell you where it
 * belongs" instead of guessing a bucket.
 */
export const UNKNOWN_CATEGORY_COLOR = "var(--ink-4)"

export function categoryColor(category: StatusCategory | null): string {
  return category ? CATEGORY_COLOR[category] : UNKNOWN_CATEGORY_COLOR
}

/** Reading order for the meter: not started, in flight, finished. Never a sort by size. */
export const CATEGORY_ORDER: StatusCategory[] = ["TODO", "IN_PROGRESS", "DONE"]

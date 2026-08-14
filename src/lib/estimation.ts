import type { EstimationSchemeSummary } from "@/api/projects"

/**
 * The one place a stored weight becomes the word somebody picked.
 *
 * ⚠️ **An estimate is stored as a weight and displayed as a label (ADR-0019).** `XL` lives in
 * `issues.story_points` as `8`, which is why burndown, velocity, `story_points_at_add`, the backlog's
 * sums and every jME filter were untouched by estimation schemes — they add numbers, and they always
 * did. The scale exists here and nowhere below the interface.
 *
 * ⚠️ **A weight matching no option renders as the raw number**, and that is the documented cost of the
 * decision rather than a gap. An issue estimated `XL` (8) in a T-shirt project still reads `8` after
 * the project moves to Linear, which has no 8 — the team estimated something, and no scheme change can
 * know what they would have said instead.
 */

/** ⚠️ Null is the empty selection under every scheme, never an option a scale has to carry. */
export const UNESTIMATED = null

/**
 * The label for a stored weight, or the number itself.
 *
 * ⚠️ Where two options share a weight this takes the first in the scheme's order. Stated rather than
 * tie-broken — any rule invented here would be arbitrary.
 */
export function estimationLabel(
  weight: number | null | undefined,
  scheme: EstimationSchemeSummary | null | undefined,
): string {
  if (weight === null || weight === undefined) {
    return "—"
  }

  const option = scheme?.items.find((candidate) => candidate.weight === weight)

  return option ? option.label : String(weight)
}

/**
 * Whether a stored weight is still on the project's scale.
 *
 * Used to say so on the one screen where it matters — the picker, which would otherwise silently show
 * nothing selected for an estimate that is perfectly real.
 */
export function isOffScale(
  weight: number | null | undefined,
  scheme: EstimationSchemeSummary | null | undefined,
): boolean {
  if (weight === null || weight === undefined || !scheme) {
    return false
  }

  return !scheme.items.some((candidate) => candidate.weight === weight)
}

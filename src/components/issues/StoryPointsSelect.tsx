import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { estimationLabel, isOffScale } from "@/lib/estimation"
import type { EstimationSchemeSummary } from "@/api/projects"

/** The value the select uses for "no estimate" — a select cannot hold null, and "" is falsy. */
const NONE = "__unestimated__"

interface StoryPointsSelectProperties {
  scheme: EstimationSchemeSummary | null | undefined
  storyPoints: number | null | undefined
  onChange: (storyPoints: number | null) => void
  className?: string
  ariaLabel?: string
}

/**
 * An estimate, picked from the project's scale.
 *
 * ⚠️ **The story-points field stopped being a free number.** A team on Fibonacci had nothing stopping
 * somebody typing `7.5`, and a team estimating in T-shirt sizes had nowhere to put an `XL` at all. The
 * options come from the project's scheme; the value stored is the option's **weight** (ADR-0019), so
 * everything that sums estimates is untouched.
 *
 * ⚠️ **With no scheme this renders nothing at all**, and the caller shows nothing in its place. A
 * project that does not estimate should not have an empty select where its estimate would be — see
 * {@link StoryPointsControl}, which is what callers use so that decision lives in one place.
 *
 * ⚠️ **An off-scale estimate is kept and shown**, not silently blanked. Changing a project's scheme
 * rewrites nothing, so an issue estimated 8 in a project now on Linear still holds 8 — it appears as
 * its own option, marked, and stays until somebody re-estimates it.
 */
export function StoryPointsSelect({
  scheme,
  storyPoints,
  onChange,
  className,
  ariaLabel = "Story points",
}: StoryPointsSelectProperties) {
  if (!scheme) {
    return null
  }

  const offScale = isOffScale(storyPoints, scheme)

  return (
    <Select
      value={storyPoints === null || storyPoints === undefined ? NONE : String(storyPoints)}
      onValueChange={(value) => onChange(value === NONE ? null : Number(value))}
    >
      <SelectTrigger className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Not estimated</SelectItem>

        {scheme.items.map((item) => (
          <SelectItem key={item.label} value={String(item.weight)}>
            {item.label}
          </SelectItem>
        ))}

        {offScale && (
          <SelectItem value={String(storyPoints)}>
            {String(storyPoints)} — not on this scale
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}

/**
 * The estimate as a screen shows it: a picker where the caller may edit, a label where it may not, and
 * **nothing at all** where the project does not estimate.
 *
 * The three-way decision is here rather than at each of the three call sites — the issue rail, the
 * backlog row and the create dialog — because "there is no control when there is no scheme" is the one
 * rule all three have to get right.
 */
export function StoryPointsControl({
  scheme,
  storyPoints,
  canEdit,
  onChange,
  className,
}: StoryPointsSelectProperties & { canEdit: boolean }) {
  if (!scheme) {
    return null
  }

  if (!canEdit) {
    return <span className="tabular-nums">{estimationLabel(storyPoints, scheme)}</span>
  }

  return (
    <StoryPointsSelect
      scheme={scheme}
      storyPoints={storyPoints}
      onChange={onChange}
      className={className}
    />
  )
}

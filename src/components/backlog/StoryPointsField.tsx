import { StoryPointsSelect } from "@/components/issues/StoryPointsSelect"
import { estimationLabel } from "@/lib/estimation"
import type { EstimationSchemeSummary } from "@/api/projects"

/**
 * An issue's estimate, edited in place on a backlog row — estimation during planning should not cost a
 * dialog.
 *
 * ⚠️ **It was a free-text field and is now the project's scale.** Typing an estimate meant a Fibonacci
 * team could enter `7.5` and a T-shirt team could not enter `XL` at all; the options now come from the
 * scheme and the value stored is the option's weight (ADR-0019), so the section sums below are the same
 * arithmetic they always were.
 *
 * ⚠️ **A project that does not estimate shows nothing here** — not a dash, not an empty select. The
 * column simply is not part of that project's backlog.
 *
 * A member who cannot edit issues sees the label, read-only.
 */
export function StoryPointsField({
  scheme,
  storyPoints,
  editable,
  onCommit,
}: {
  scheme: EstimationSchemeSummary | null
  storyPoints: number | null
  editable: boolean
  onCommit: (storyPoints: number | null) => void
}) {
  if (!scheme) {
    return null
  }

  if (!editable) {
    return (
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {estimationLabel(storyPoints, scheme)}
      </span>
    )
  }

  return (
    <StoryPointsSelect
      scheme={scheme}
      storyPoints={storyPoints}
      ariaLabel="Estimate"
      className="h-7 w-24 shrink-0 text-xs"
      onChange={onCommit}
    />
  )
}

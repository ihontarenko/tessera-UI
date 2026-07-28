import type { BoardCard } from "@/api/boards"

/**
 * What the board actually shows (Phase-2 tickets 05/06): the quick-filter toggles a member turns on,
 * plus the board's done-threshold. Both narrow the already-loaded payload client-side — there is no
 * backend filter endpoint.
 *
 * The quick filters are a deliberate **stub** for ADR-0008's jME engine: each carries the jME
 * expression it stands in for, and {@link BoardFilter.matches} is the seam that expression evaluator
 * replaces. Keeping the expressions here makes the toggles the acceptance oracle for the real thing —
 * the jME version must agree with the predicate beside it, card for card.
 */

export interface BoardFilterContext {
  currentMemberId: string | null
}

export interface BoardFilter {
  id: string
  label: string
  /** The ADR-0008 jME expression this predicate stands in for, verbatim. */
  expression: string
  matches: (card: BoardCard, context: BoardFilterContext) => boolean
}

export const QUICK_FILTERS: BoardFilter[] = [
  {
    id: "my-issues",
    label: "My issues",
    expression: "issue.assignee == #currentMember",
    matches: (card, context) => context.currentMemberId !== null && card.assigneeId === context.currentMemberId,
  },
  {
    id: "unassigned",
    label: "Unassigned",
    expression: "issue.assignee is null",
    matches: (card) => card.assigneeId === null,
  },
  {
    // `open` is the server's projection of the `resolution IS NULL ⇔ open` invariant (ADR-0004).
    id: "unresolved",
    label: "Unresolved",
    expression: "issue.resolution is null",
    matches: (card) => card.open,
  },
]

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * The cards still *on* the board: completed ones that have aged past the threshold drop off (ticket
 * 06). Measured against `resolvedAt` — the recorded completion time — so editing a done issue never
 * resurrects it. A `null` threshold drops nothing; a DONE card with no recorded completion time is
 * kept rather than guessed at.
 *
 * Distinct from {@link applyQuickFilters}: this narrows what the board *contains*, so WIP counts are
 * taken after it, whereas a quick filter only narrows what one viewer is looking at.
 */
export function withoutAgedOutCards(
  cards: BoardCard[],
  hideDoneOlderThanDays: number | null,
  now: number,
): BoardCard[] {
  if (hideDoneOlderThanDays === null) {
    return cards
  }

  const cutoff = now - hideDoneOlderThanDays * MILLISECONDS_PER_DAY

  return cards.filter((card) => {
    if (card.status?.category !== "DONE" || card.resolvedAt === null) {
      return true
    }
    return new Date(card.resolvedAt).getTime() >= cutoff
  })
}

/** The active quick filters, AND-combined (ticket 05) — a per-viewer narrowing, never persisted. */
export function applyQuickFilters(
  cards: BoardCard[],
  activeFilterIds: string[],
  context: BoardFilterContext,
): BoardCard[] {
  const activeFilters = QUICK_FILTERS.filter((filter) => activeFilterIds.includes(filter.id))

  if (activeFilters.length === 0) {
    return cards
  }

  return cards.filter((card) => activeFilters.every((filter) => filter.matches(card, context)))
}

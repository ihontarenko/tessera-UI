import type { BoardCard } from "@/api/boards"
import type { BoardFilterView } from "@/api/boardFilters"
import type { TranslatableText } from "@/lib/translatableText"

/**
 * What the board actually shows: the quick filters a member turns on, plus the board's done-threshold.
 *
 * The two narrow in different places, and that difference is the whole design (ADR-0008). The
 * done-threshold narrows what the board *contains*, so it runs here and WIP counts are taken after it.
 * A quick filter narrows what *one viewer is looking at*, so the predicate is evaluated **server-side**
 * as jME and the response marks the surviving cards in `matchedCardIds` — this module only hides the
 * rest. A column at its limit does not stop being at its limit because someone filtered down to their
 * own issues.
 *
 * The Phase-2 stub that lived here — three hardcoded predicates evaluated over the loaded payload — is
 * gone. The seam it was built against is what stayed: same `BoardFilter` shape, same toggle ids, same
 * hook-free key-returning module; only the evaluator moved to the backend. The expressions are no
 * longer written here at all, because the server now owns what a filter *means*.
 */

/** A toggle as the toolbar renders it: server-defined, with its copy resolved by the component. */
export interface BoardFilter {
  id: string
  /** The toggle's copy — the module is hook-free, so the toolbar resolves the key. */
  label: TranslatableText
  /** The jME predicate, authored server-side (ADR-0008) and handed straight back through `?filter=`. */
  expression: string
  /** On when nobody has chosen anything. */
  selectedByDefault: boolean
  /** Cannot be combined: choosing it clears the rest, and choosing another clears it. */
  exclusive: boolean
}

/** The backend's catalog in the shape the toolbar wants, with its translation key rebuilt. */
export function toBoardFilters(catalog: BoardFilterView[]): BoardFilter[] {
  return catalog.map((filter) => ({
    id: filter.id,
    label: { key: filter.labelKey, text: filter.label },
    expression: filter.expression,
    selectedByDefault: filter.selectedByDefault,
    exclusive: filter.exclusive,
  }))
}

/** What is on before anyone has chosen — whichever filters the catalog marks as the resting state. */
export function defaultFilterIds(filters: BoardFilter[]): string[] {
  return filters.filter((filter) => filter.selectedByDefault).map((filter) => filter.id)
}

/**
 * The selection after a toggle is clicked.
 *
 * The rules live here and the catalog says which filter they apply to, so neither side hard-codes the
 * other's business: an exclusive filter replaces the selection, choosing anything else drops the
 * exclusive ones, and a selection that empties falls back to the default rather than to nothing —
 * "no filter at all" is not a state the toolbar can show, which is what made an unfiltered board look
 * like a board with a broken filter.
 */
export function toggleFilterId(filters: BoardFilter[], activeFilterIds: string[], filterId: string): string[] {
  const chosen = filters.find((filter) => filter.id === filterId)

  if (!chosen) {
    return activeFilterIds
  }

  if (activeFilterIds.includes(filterId)) {
    const remaining = activeFilterIds.filter((entry) => entry !== filterId)

    return remaining.length > 0 ? remaining : defaultFilterIds(filters)
  }

  if (chosen.exclusive) {
    return [filterId]
  }

  const exclusiveIds = new Set(filters.filter((filter) => filter.exclusive).map((filter) => filter.id))

  return [...activeFilterIds.filter((entry) => !exclusiveIds.has(entry)), filterId]
}

/**
 * The active toggles as one predicate, or `null` when none are on.
 *
 * Each is bracketed before being joined: a predicate is arbitrary jME, and `in` binds looser than
 * `and` there, so concatenating two correct filters without brackets can silently produce a third
 * meaning. `null` is "send no filter at all" rather than a predicate that matches everything — the
 * server then skips hydrating the filter view-model entirely.
 */
export function composeFilterExpression(filters: BoardFilter[], activeFilterIds: string[]): string | null {
  const active = filters.filter((filter) => activeFilterIds.includes(filter.id))

  if (active.length === 0) {
    return null
  }

  return andTogether(active.map((filter) => filter.expression))
}

/**
 * Several predicates as one, each bracketed. Exported because the same rule governs combining a saved
 * filter with the toggles, and getting the brackets wrong is silent: `in` binds looser than `and` in
 * jME, so joining two correct predicates without them can quietly mean a third thing.
 */
export function andTogether(expressions: (string | null)[]): string | null {
  const present = expressions.filter((expression): expression is string => expression !== null && expression.trim() !== "")

  if (present.length === 0) {
    return null
  }

  return present.map((expression) => `(${expression.trim()})`).join(" and ")
}

/**
 * The cards the server's predicate selected. `null` means the request carried no filter, so nothing is
 * hidden — distinct from an empty list, which means the filter matched nothing and the board should
 * look empty rather than unfiltered.
 */
export function applyMatchedCardIds(cards: BoardCard[], matchedCardIds: string[] | null | undefined): BoardCard[] {
  // `== null`, not `=== null`: an absent field and a null one mean the same thing here — no predicate
  // was evaluated — and treating a missing one as "nothing matched" empties the whole board.
  if (matchedCardIds == null) {
    return cards
  }

  const matched = new Set(matchedCardIds)

  return cards.filter((card) => matched.has(card.id))
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * The cards still *on* the board: completed ones that have aged past the threshold drop off (ticket
 * 06). Measured against `resolvedAt` — the recorded completion time — so editing a done issue never
 * resurrects it. A `null` threshold drops nothing; a DONE card with no recorded completion time is
 * kept rather than guessed at.
 *
 * Distinct from {@link applyMatchedCardIds}: this narrows what the board *contains*, so WIP counts are
 * taken after it, whereas a quick filter only narrows what one viewer is looking at.
 */
export function withoutAgedOutCards(
  cards: BoardCard[],
  hideDoneOlderThanDays: number | null | undefined,
  now: number,
): BoardCard[] {
  // `== null` for the same reason as above: an unset threshold that arrives absent rather than null
  // would otherwise compute a NaN cutoff, and every completed card would fail the comparison.
  if (hideDoneOlderThanDays == null) {
    return cards
  }

  const cutoff = now - hideDoneOlderThanDays * MILLISECONDS_PER_DAY

  return cards.filter((card) => {
    if (card.status?.category !== "DONE" || card.resolvedAt == null) {
      return true
    }
    return new Date(card.resolvedAt).getTime() >= cutoff
  })
}

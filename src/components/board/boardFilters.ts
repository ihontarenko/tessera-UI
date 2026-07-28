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
}

/** The backend's catalog in the shape the toolbar wants, with its translation key rebuilt. */
export function toBoardFilters(catalog: BoardFilterView[]): BoardFilter[] {
  return catalog.map((filter) => ({
    id: filter.id,
    label: { key: filter.labelKey, text: filter.label },
    expression: filter.expression,
  }))
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
export function applyMatchedCardIds(cards: BoardCard[], matchedCardIds: string[] | null): BoardCard[] {
  if (matchedCardIds === null) {
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

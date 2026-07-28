import { httpClient } from "@/api/httpClient"

/**
 * The built-in board filters (ADR-0008), authored server-side.
 *
 * The client fetches what a filter *means* rather than holding a copy of it: that is what retired the
 * Phase-2 stub, and it is why changing "unassigned" is a one-line backend edit instead of two changes
 * that can drift. Not project-scoped — the catalog is the same everywhere, like issue types.
 */
export interface BoardFilterView {
  id: string
  /** Translation key for the toggle's copy. */
  labelKey: string
  /** English fallback, so an untranslated key still renders a word. */
  label: string
  /** The jME predicate, sent straight back to the board endpoint as `?filter=`. */
  expression: string
}

export function fetchBoardFilters() {
  return httpClient.get<BoardFilterView[]>("/board-filters").then((response) => response.data)
}

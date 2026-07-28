import { httpClient } from "@/api/httpClient"
import type { MemberSummary } from "@/api/members"

/**
 * Saved board filters (ADR-0008): a member names a jME predicate once and reuses it, or shares it with
 * the project. Applying one is just handing its `expression` back to the board as `?filter=` — there is
 * no "run this filter" endpoint, because a filter is a string, not a stored procedure.
 */

export type SavedFilterVisibility = "PRIVATE" | "PROJECT" | "GLOBAL"

export interface SavedFilterView {
  id: string
  /** `null` for a shipped preset, which belongs to every project rather than to one. */
  projectId: string | null
  name: string
  description: string | null
  expression: string
  visibility: SavedFilterVisibility
  /** `null` for a preset — nobody authored it, so there is nobody to show. */
  owner: MemberSummary | null
  /** Whoever owns it may change it; everyone else may only use it. Always false for a preset. */
  editable: boolean
  createdAt: string
  updatedAt: string
}

export interface SaveFilterRequest {
  name: string
  description: string | null
  expression: string
  /** Never `GLOBAL` — presets are seeded, and the server refuses to mint one over the API. */
  visibility: Exclude<SavedFilterVisibility, "GLOBAL">
}

/**
 * What the editor learns about an expression it has not applied yet. A broken expression comes back as
 * `valid: false` with a message rather than an HTTP error — mid-edit is not a failed request.
 */
export interface FilterPreviewView {
  valid: boolean
  message: string | null
  /** `null` when the expression could not run. */
  matchedCount: number | null
  totalCount: number
}

export function fetchSavedFilters(projectId: string) {
  return httpClient.get<SavedFilterView[]>(`/projects/${projectId}/filters`).then((response) => response.data)
}

export function createSavedFilter(projectId: string, request: SaveFilterRequest) {
  return httpClient.post<SavedFilterView>(`/projects/${projectId}/filters`, request).then((response) => response.data)
}

export function updateSavedFilter(projectId: string, savedFilterId: string, request: SaveFilterRequest) {
  return httpClient
    .put<SavedFilterView>(`/projects/${projectId}/filters/${savedFilterId}`, request)
    .then((response) => response.data)
}

export function deleteSavedFilter(projectId: string, savedFilterId: string) {
  return httpClient.delete<void>(`/projects/${projectId}/filters/${savedFilterId}`).then((response) => response.data)
}

export function previewFilter(projectId: string, expression: string) {
  return httpClient
    .post<FilterPreviewView>(`/projects/${projectId}/filters/preview`, { expression })
    .then((response) => response.data)
}

// ── The grammar reference behind the editor's help icon ───────────────────────────────────────────

export interface GrammarEntry {
  /** What to type — an accessor, an operator, or a whole example expression. */
  syntax: string
  explanation: string
}

export interface GrammarSection {
  id: string
  title: string
  entries: GrammarEntry[]
}

/**
 * Fetched rather than hardcoded here: the server generates it from the same constants the evaluator
 * reports errors against, so the cheat-sheet cannot drift from what the engine actually resolves.
 */
export function fetchFilterGrammar() {
  return httpClient.get<{ sections: GrammarSection[] }>("/board-filters/reference").then((response) => response.data)
}

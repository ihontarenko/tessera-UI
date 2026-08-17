import { httpClient } from "@/api/httpClient"

/**
 * The live-data directives a wiki page embeds, resolved at view time (TSSR-18).
 *
 * ⚠️ **Resolution is addressed by page, and that is the security boundary rather than a convenience.**
 * The server answers a directive only when its exact line appears in that page's *stored* markdown — so
 * this endpoint can only ever say what the document already says. Sending a directive the page does not
 * contain comes back `NOT_ON_THIS_PAGE`, which is not a bug to work around.
 */

export type BlockStatus = "RESOLVED" | "NOT_FOUND" | "UNKNOWN_DIRECTIVE" | "NOT_ON_THIS_PAGE"

export interface IssueBlock {
  issueKey: string
  summary: string
  typeName: string | null
  statusName: string | null
  statusCategory: string | null
  /** ⚠️ Null means "drawn from the category", never "no colour" (TSSR-21). */
  statusColor: string | null
  priorityName: string | null
  assigneeName: string | null
  /** ⚠️ The stored weight, not the word the team picked for it — `XL` is `8` (ADR-0019). */
  storyPoints: number | null
  open: boolean
  resolutionName: string | null
}

export interface SprintBlock {
  projectKey: string
  name: string
  goal: string | null
  state: string
  endDate: string | null
  issueCount: number
  completedIssueCount: number
  /** ⚠️ Null means the project does not estimate — not zero, which would read as "committed to nothing". */
  storyPoints: number | null
  completedStoryPoints: number | null
}

export interface BoardBlock {
  projectKey: string
  projectName: string
  columns: Array<{ name: string; issueCount: number }>
}

/**
 * One directive, answered.
 *
 * ⚠️ **One nullable field per block kind, and `name` says which one to read.** Not a discriminated
 * union: the server sends a flat record so nothing on either side has to switch twice, once to parse and
 * once to render.
 */
export interface PageBlockView {
  name: string
  argument: string
  status: BlockStatus
  issue: IssueBlock | null
  sprint: SprintBlock | null
  board: BoardBlock | null
}

export function resolveWikiBlocks(
  projectId: string,
  pageId: string,
  directives: ReadonlyArray<{ name: string; argument: string }>,
) {
  return httpClient
    .post<PageBlockView[]>(`/projects/${projectId}/wiki/pages/${pageId}/blocks`, { directives })
    .then((response) => response.data)
}

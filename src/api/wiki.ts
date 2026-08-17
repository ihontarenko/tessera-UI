import { httpClient } from "@/api/httpClient"
import type { MemberSummary } from "@/api/members"

/**
 * The wiki: a tree of sections, and the pages filed into them (TSSR-15, TSSR-16).
 *
 * ⚠️ **Two resources, not one.** The category tree is deliberately agnostic — it holds pages today and
 * is built so a second kind of content costs a constant on the server rather than a migration. That is
 * why the tree lives under `/categories` and not under `/wiki`, and why it is worth resisting the urge
 * to fold these into one "wiki" endpoint here: the moment a file cabinet arrives it asks the same tree
 * for its own counts.
 */

// ── The tree ─────────────────────────────────────────────────────────────────────────────────────

/**
 * One section and everything under it.
 *
 * ⚠️ **Nested, and the server sends it that way.** A flat list with a `parentId` would make every
 * consumer re-derive the shape, and the first one to mishandle an orphan draws a subsection at the root.
 *
 * `itemCount` is what is filed *directly* here, never the subtree's total — a number that summed
 * descendants would read as a bug beside a section whose own page list is empty.
 */
export interface CategoryNode {
  id: string
  name: string
  slug: string
  sortOrder: number
  itemCount: number
  children: CategoryNode[]
}

export interface SaveCategoryRequest {
  name: string
  /** Where it goes. Null is the root. ⚠️ Read on create and ignored on rename — moving is its own call. */
  parentId?: string | null
}

export interface MoveCategoryRequest {
  parentId: string | null
  /** Index among the new siblings, from zero. ⚠️ Not a sort-order value — those have gaps in them. */
  position: number
}

export function getCategories(projectId: string) {
  return httpClient
    .get<CategoryNode[]>(`/projects/${projectId}/categories`)
    .then((response) => response.data)
}

export function createCategory(projectId: string, request: SaveCategoryRequest) {
  return httpClient
    .post<CategoryNode>(`/projects/${projectId}/categories`, request)
    .then((response) => response.data)
}

export function renameCategory(projectId: string, categoryId: string, request: SaveCategoryRequest) {
  return httpClient
    .put<CategoryNode>(`/projects/${projectId}/categories/${categoryId}`, request)
    .then((response) => response.data)
}

export function moveCategory(projectId: string, categoryId: string, request: MoveCategoryRequest) {
  return httpClient
    .put<CategoryNode>(`/projects/${projectId}/categories/${categoryId}/position`, request)
    .then((response) => response.data)
}

/** ⚠️ Refused while the section holds a subsection or a page, with a message saying which. */
export function deleteCategory(projectId: string, categoryId: string) {
  return httpClient.delete<void>(`/projects/${projectId}/categories/${categoryId}`).then(() => undefined)
}

// ── The pages ────────────────────────────────────────────────────────────────────────────────────

/** A page as a list shows it. ⚠️ No `contentMarkdown` — an index that carried it would ship the wiki. */
export interface WikiPageSummary {
  id: string
  title: string
  slug: string
  excerpt: string | null
  /** ⚠️ Null means *filed nowhere*, which is a place — it is where every page starts. */
  categoryId: string | null
  author: MemberSummary | null
  updatedBy: MemberSummary | null
  createdAt: string
  updatedAt: string
}

export interface WikiPageDetail extends WikiPageSummary {
  contentMarkdown: string | null
}

export interface CreateWikiPageRequest {
  title: string
  contentMarkdown?: string | null
  categoryId?: string | null
}

/** ⚠️ A replace, not a patch — and there is no version history behind it. */
export interface UpdateWikiPageRequest {
  title: string
  contentMarkdown?: string | null
}

export function getWikiPages(projectId: string, search?: string) {
  return httpClient
    .get<WikiPageSummary[]>(`/projects/${projectId}/wiki/pages`, {
      params: search ? { search } : undefined,
    })
    .then((response) => response.data)
}

export function getWikiPage(projectId: string, pageId: string) {
  return httpClient
    .get<WikiPageDetail>(`/projects/${projectId}/wiki/pages/${pageId}`)
    .then((response) => response.data)
}

export function createWikiPage(projectId: string, request: CreateWikiPageRequest) {
  return httpClient
    .post<WikiPageDetail>(`/projects/${projectId}/wiki/pages`, request)
    .then((response) => response.data)
}

export function updateWikiPage(projectId: string, pageId: string, request: UpdateWikiPageRequest) {
  return httpClient
    .put<WikiPageDetail>(`/projects/${projectId}/wiki/pages/${pageId}`, request)
    .then((response) => response.data)
}

export function fileWikiPage(projectId: string, pageId: string, categoryId: string | null) {
  return httpClient
    .put<WikiPageDetail>(`/projects/${projectId}/wiki/pages/${pageId}/category`, { categoryId })
    .then((response) => response.data)
}

/** ⚠️ Permanent — a wiki page has no archive the way an issue does. */
export function deleteWikiPage(projectId: string, pageId: string) {
  return httpClient.delete<void>(`/projects/${projectId}/wiki/pages/${pageId}`).then(() => undefined)
}

// ── Reading the tree ─────────────────────────────────────────────────────────────────────────────

/**
 * Every section in the tree, flattened with its depth — what a picker offers and what a sidebar
 * indents.
 *
 * ⚠️ **Derived here rather than asked for.** The server sends the tree nested because that is the shape
 * that cannot be drawn wrong; a flat list with a depth is what a `<select>` needs, and turning one into
 * the other is four lines that belong beside the type rather than in each component that wants it.
 */
export function flattenCategories(nodes: CategoryNode[], depth = 0): Array<{ node: CategoryNode; depth: number }> {
  return nodes.flatMap((node) => [{ node, depth }, ...flattenCategories(node.children, depth + 1)])
}

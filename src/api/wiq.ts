import { wiqClient } from "@/api/wiqClient"

/**
 * What Tessera reads from **WiQ** (WIQ-10).
 *
 * ⚠️ **A read API first.** Rendering somebody else's page is the common path and creating one is the
 * rare one, so this module is deliberately small: the tree, a section's pages, and one page.
 *
 * ⚠️ **Nothing in a payload identifies a person except an Identity subject and a display name**
 * (WIQ-1 §9). WiQ has its own `members` table with its own avatars and Tessera has its own; whoever
 * renders draws the face it knows. So a page's author arrives as a subject, and **Tessera maps it to
 * its own member row** — never rendering a WiQ avatar, or one person wears two faces on one screen.
 */

/**
 * One section of WiQ's tree and everything under it.
 *
 * ⚠️ **`readable: false` is a breadcrumb.** It is an ancestor of a branch this reader was granted,
 * carried so the tree has a path down to it (WIQ-1 §4) — with no slug, no count and none of its own
 * contents. Do not build a link from one, and do not read its zero as information.
 */
export interface WiqCategoryNode {
  id: string
  name: string
  slug: string | null
  sortOrder: number
  itemCount: number
  readable: boolean
  children: WiqCategoryNode[]
}

/** A person, as every WiQ payload names one — the subject is the only identifier both products share. */
export interface WiqMember {
  id: string
  subject: string
  displayName: string | null
  email: string | null
}

export interface WiqPageSummary {
  id: string
  /** ⚠️ What a link names, for good. Minted once and never re-minted (WIQ-1 §7). */
  address: string
  title: string
  slug: string
  excerpt: string | null
  categoryId: string
  author: WiqMember | null
  updatedBy: WiqMember | null
  createdAt: string
  updatedAt: string
}

export interface WiqPageDetail extends WiqPageSummary {
  contentMarkdown: string | null
  revisionCount: number
}

export function getWiqTree() {
  return wiqClient.get<WiqCategoryNode[]>("/categories").then((response) => response.data)
}

export function getWiqPagesIn(categoryId: string) {
  return wiqClient
    .get<WiqPageSummary[]>(`/categories/${categoryId}/pages`)
    .then((response) => response.data)
}

export function getWiqPage(pageId: string) {
  return wiqClient.get<WiqPageDetail>(`/pages/${pageId}`).then((response) => response.data)
}

export function createWiqPage(categoryId: string, title: string, contentMarkdown: string) {
  return wiqClient
    .post<WiqPageDetail>(`/categories/${categoryId}/pages`, { title, contentMarkdown })
    .then((response) => response.data)
}

export function updateWiqPage(pageId: string, title: string, contentMarkdown: string) {
  return wiqClient
    .put<WiqPageDetail>(`/pages/${pageId}`, { title, contentMarkdown })
    .then((response) => response.data)
}

/**
 * Every section of the tree, flattened with its depth — what a picker offers.
 *
 * ⚠️ Derived here rather than asked for: WiQ sends the tree nested because that is the shape that
 * cannot be drawn wrong, and a flat list with a depth is what a `<select>` needs.
 */
export function flattenWiqTree(
  nodes: WiqCategoryNode[],
  depth = 0,
): Array<{ node: WiqCategoryNode; depth: number }> {
  return nodes.flatMap((node) => [{ node, depth }, ...flattenWiqTree(node.children, depth + 1)])
}

import { kiwiClient } from "@/api/kiwiClient"

/**
 * What Tessera reads and writes in **Kiwi** (KW-10).
 *
 * ⚠️ **Nothing in a payload identifies a person except an Identity subject and a display name**
 * (KW-1 §9). Kiwi has its own `members` table with its own avatars and Tessera has its own; whoever
 * renders draws the face it knows. So a page's author arrives as a subject, and **Tessera maps it to
 * its own member row** — never rendering a Kiwi avatar, or one person wears two faces on one screen.
 *
 * ⚠️ **There is no section management here, and that is the shape rather than an omission.** Kiwi owns
 * its tree: creating, renaming, moving and deleting a section happen on Kiwi's own screens, where the
 * grants that govern them are visible. A consumer that offered those controls would be offering
 * somebody a button whose refusal it cannot explain.
 */

/**
 * One section of Kiwi's tree and everything under it.
 *
 * ⚠️ **`readable: false` is a breadcrumb.** It is an ancestor of a branch this reader was granted,
 * carried so the tree has a path down to it (KW-1 §4) — with no slug, no count and none of its own
 * contents. Do not build a link from one, and do not read its zero as information.
 */
export interface KiwiCategoryNode {
  id: string
  name: string
  slug: string | null
  sortOrder: number
  itemCount: number
  readable: boolean
  children: KiwiCategoryNode[]
}

/** A person, as every Kiwi payload names one — the subject is the only identifier both products share. */
export interface KiwiMember {
  id: string
  subject: string
  displayName: string | null
  email: string | null
}

export interface KiwiPageSummary {
  id: string
  /** ⚠️ What a link names, for good. Minted once and never re-minted (KW-1 §7). */
  address: string
  title: string
  slug: string
  excerpt: string | null
  categoryId: string
  author: KiwiMember | null
  updatedBy: KiwiMember | null
  createdAt: string
  updatedAt: string
}

export interface KiwiPageDetail extends KiwiPageSummary {
  contentMarkdown: string | null
  /** ⚠️ Never zero: Kiwi writes a revision on every save from the first one (KW-1 §6). */
  revisionCount: number
}

export function getKiwiTree() {
  return kiwiClient.get<KiwiCategoryNode[]>("/categories").then((response) => response.data)
}

export function getKiwiPagesIn(categoryId: string) {
  return kiwiClient
    .get<KiwiPageSummary[]>(`/categories/${categoryId}/pages`)
    .then((response) => response.data)
}

export function getKiwiPage(pageId: string) {
  return kiwiClient.get<KiwiPageDetail>(`/pages/${pageId}`).then((response) => response.data)
}

export function createKiwiPage(categoryId: string, title: string, contentMarkdown: string) {
  return kiwiClient
    .post<KiwiPageDetail>(`/categories/${categoryId}/pages`, { title, contentMarkdown })
    .then((response) => response.data)
}

export function updateKiwiPage(pageId: string, title: string, contentMarkdown: string) {
  return kiwiClient
    .put<KiwiPageDetail>(`/pages/${pageId}`, { title, contentMarkdown })
    .then((response) => response.data)
}

/** Re-file a page into another section. ⚠️ The address does not change with it (KW-1 §7). */
export function fileKiwiPage(pageId: string, categoryId: string) {
  return kiwiClient
    .put<KiwiPageDetail>(`/pages/${pageId}/category`, { categoryId })
    .then((response) => response.data)
}

/**
 * ⚠️ **Not the same permanence Tessera's own wiki had.** Kiwi keeps a revision per save, so a deleted
 * page is a deleted history rather than a deleted paragraph — worth saying on the screen, and the
 * screen does.
 */
export function deleteKiwiPage(pageId: string) {
  return kiwiClient.delete<void>(`/pages/${pageId}`).then(() => undefined)
}

/**
 * Search, across everything this reader may see (KW-16).
 *
 * ⚠️ **It spans Kiwi's whole tree, not a project's branch** — there is nowhere in the request to say
 * "only under here", because a search has no place to declare and Kiwi resolves the readable set from
 * the caller's own grants. Narrowing to a project's root is therefore the *caller's* job, and
 * {@link isInsideSubtree} is how this screen does it.
 *
 * ⚠️ **An empty query answers with an empty list**, not with everything — so this is never a way to
 * list a section's pages. That is {@link getKiwiPagesIn}.
 */
export function searchKiwiPages(query: string) {
  return kiwiClient
    .get<KiwiPageSummary[]>("/pages", { params: { query } })
    .then((response) => response.data)
}

/**
 * Every section of the tree, flattened with its depth — what a picker offers and what a sidebar
 * indents.
 *
 * ⚠️ Derived here rather than asked for: Kiwi sends the tree nested because that is the shape that
 * cannot be drawn wrong, and a flat list with a depth is what a `<select>` needs.
 */
export function flattenKiwiTree(
  nodes: KiwiCategoryNode[],
  depth = 0,
): Array<{ node: KiwiCategoryNode; depth: number }> {
  return nodes.flatMap((node) => [{ node, depth }, ...flattenKiwiTree(node.children, depth + 1)])
}

/** The node with this identifier, anywhere in the tree, or null where the reader cannot see it. */
export function findKiwiSection(nodes: KiwiCategoryNode[], categoryId: string): KiwiCategoryNode | null {
  for (const node of nodes) {
    if (node.id === categoryId) {
      return node
    }

    const found = findKiwiSection(node.children, categoryId)

    if (found !== null) {
      return found
    }
  }

  return null
}

/**
 * Whether a section identifier is this subtree's own or one of its descendants'.
 *
 * ⚠️ Used to keep a whole-tree search inside a project's branch. A page filed elsewhere in Kiwi is not
 * this project's wiki even when the same person may read both — showing it here would quietly make the
 * project's root setting decorative.
 */
export function isInsideSubtree(root: KiwiCategoryNode, categoryId: string): boolean {
  return findKiwiSection([root], categoryId) !== null
}

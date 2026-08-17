import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiErrorMessage } from "@/api/errors"
import {
  createCategory,
  createWikiPage,
  deleteCategory,
  deleteWikiPage,
  fileWikiPage,
  getCategories,
  getWikiPage,
  getWikiPages,
  moveCategory,
  renameCategory,
  updateWikiPage,
  type CreateWikiPageRequest,
  type MoveCategoryRequest,
  type SaveCategoryRequest,
  type UpdateWikiPageRequest,
} from "@/api/wiki"

/**
 * Everything the Wiki tab reads and writes, in one place (TSSR-17).
 *
 * ⚠️ **The tree and the page list are two queries, not one.** The screen needs both at once and the
 * server sends them separately for a reason — the category tree is agnostic and belongs to no feature,
 * so folding them into one "wiki" read here would put the tree behind the wiki's cache key and make the
 * next consumer of the tree invalidate the wiki to see its own change.
 *
 * ⚠️ **Every write invalidates both.** Almost all of them touch both shapes: creating a page changes a
 * section's `itemCount`, deleting a section is refused unless it is empty but re-filing away from it is
 * not, and the counts are what a reader trusts. Invalidating the pair costs one extra round trip and
 * removes a whole class of "the number beside the section is wrong" reports.
 */
export function useWiki(projectId: string, search: string) {
  const queryClient = useQueryClient()

  const categories = useQuery({
    queryKey: ["wiki-categories", projectId],
    queryFn: () => getCategories(projectId),
  })

  const pages = useQuery({
    queryKey: ["wiki-pages", projectId, search],
    queryFn: () => getWikiPages(projectId, search || undefined),
  })

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["wiki-categories", projectId] })
    queryClient.invalidateQueries({ queryKey: ["wiki-pages", projectId] })
  }

  const addSection = useMutation({
    mutationFn: (request: SaveCategoryRequest) => createCategory(projectId, request),
    onSuccess: (section) => {
      refresh()
      toast.success(`Section “${section.name}” added`)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not add the section")),
  })

  const renameSection = useMutation({
    mutationFn: ({ categoryId, request }: { categoryId: string; request: SaveCategoryRequest }) =>
      renameCategory(projectId, categoryId, request),
    onSuccess: () => refresh(),
    onError: (error) => toast.error(apiErrorMessage(error, "Could not rename the section")),
  })

  /**
   * Re-parenting and reordering, as one call — the server takes them together because a drag is one
   * gesture.
   *
   * ⚠️ **Only reordering is reachable from the interface today** (move up, move down). Re-parenting is
   * a drag between branches, which is TSSR-17's obvious follow-up; the call takes the parent anyway so
   * that arriving at it is a component change and not a new endpoint.
   */
  const moveSection = useMutation({
    mutationFn: ({ categoryId, request }: { categoryId: string; request: MoveCategoryRequest }) =>
      moveCategory(projectId, categoryId, request),
    onSuccess: () => refresh(),
    onError: (error) => toast.error(apiErrorMessage(error, "Could not move the section")),
  })

  // ⚠️ The refusal is shown rather than swallowed. A section holding a subsection or a page is refused
  // by the server with a sentence naming which — and that sentence is the entire explanation of why
  // nothing happened.
  const removeSection = useMutation({
    mutationFn: (categoryId: string) => deleteCategory(projectId, categoryId),
    onSuccess: () => {
      refresh()
      toast.success("Section removed")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not remove the section")),
  })

  const addPage = useMutation({
    mutationFn: (request: CreateWikiPageRequest) => createWikiPage(projectId, request),
    onSuccess: (page) => {
      refresh()
      toast.success(`“${page.title}” created`)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not create the page")),
  })

  const savePage = useMutation({
    mutationFn: ({ pageId, request }: { pageId: string; request: UpdateWikiPageRequest }) =>
      updateWikiPage(projectId, pageId, request),
    onSuccess: (page) => {
      queryClient.setQueryData(["wiki-page", projectId, page.id], page)
      refresh()
      toast.success("Saved")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not save the page")),
  })

  const filePage = useMutation({
    mutationFn: ({ pageId, categoryId }: { pageId: string; categoryId: string | null }) =>
      fileWikiPage(projectId, pageId, categoryId),
    onSuccess: (page) => {
      queryClient.setQueryData(["wiki-page", projectId, page.id], page)
      refresh()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not move the page")),
  })

  const removePage = useMutation({
    mutationFn: (pageId: string) => deleteWikiPage(projectId, pageId),
    onSuccess: () => {
      refresh()
      toast.success("Page deleted")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the page")),
  })

  return {
    categories,
    pages,
    addSection,
    renameSection,
    moveSection,
    removeSection,
    addPage,
    savePage,
    filePage,
    removePage,
  }
}

/**
 * One page in full.
 *
 * ⚠️ Its own query rather than a lookup in the list, because the list deliberately does not carry
 * `contentMarkdown` — an index that shipped every document would send the whole wiki to draw a sidebar.
 */
export function useWikiPage(projectId: string, pageId: string | null) {
  return useQuery({
    queryKey: ["wiki-page", projectId, pageId],
    queryFn: () => getWikiPage(projectId, pageId as string),
    enabled: pageId !== null,
  })
}

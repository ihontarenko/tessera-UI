import { useEffect, useState } from "react"
import { BookOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/EmptyState"
import { SearchInput } from "@/components/SearchInput"
import { WikiDocument } from "@/components/wiki/WikiDocument"
import { WikiTree } from "@/components/wiki/WikiTree"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useWiki, useWikiPage } from "@/hooks/useWiki"
import { useLanguage } from "@/context/LanguageContext"
import { MANAGE_CATEGORY, WRITE_PAGE } from "@/api/permissions"
import type { CategoryNode } from "@/api/wiki"

/**
 * The Wiki tab: a tree beside a document (TSSR-17).
 *
 * **What a tracker has nowhere else to put.** A project's conventions, a runbook, a decision that
 * outlived the ticket that made it — prose that is not a work item and does not belong in a description
 * field.
 *
 * ⚠️ **The selected page lives in this component and not in the URL.** Everything else on this screen is
 * addressed by `?tab=`, and a page deserves the same — but the tab strip owns that parameter and a
 * second one written from here would fight it on every navigation. Giving the wiki its own route is
 * TSSR-17's obvious follow-up and deliberately not smuggled in here.
 *
 * ⚠️ **Search narrows the pages and never the tree.** A section that matched nothing still has to be
 * visible, or a search turns "no page mentions this" into "your sections are gone".
 */
export function WikiPanel({ projectId, permissions }: { projectId: string; permissions: string[] }) {
  const { t } = useLanguage()
  const [search, setSearch] = useState("")
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const wiki = useWiki(projectId, debouncedSearch)
  const page = useWikiPage(projectId, selectedPageId)

  const canWrite = permissions.includes(WRITE_PAGE)
  const canManageSections = permissions.includes(MANAGE_CATEGORY)

  const categories = wiki.categories.data ?? []
  const pages = wiki.pages.data ?? []

  // Land on something readable rather than on an empty right-hand side: the first page in the list,
  // and a different one whenever what is selected has stopped existing (deleted, or filtered away by a
  // search). Only when nothing is selected — never overriding a choice somebody made.
  useEffect(() => {
    if (pages.length === 0) {
      setSelectedPageId(null)
      return
    }

    if (selectedPageId === null || !pages.some((candidate) => candidate.id === selectedPageId)) {
      setSelectedPageId(pages[0].id)
    }
  }, [pages, selectedPageId])

  function addSection(parentId: string | null) {
    const name = window.prompt(parentId ? "Name the subsection" : "Name the section")

    if (name?.trim()) {
      wiki.addSection.mutate({ name: name.trim(), parentId })
    }
  }

  function addPage() {
    const title = window.prompt("Title of the new page")

    if (title?.trim()) {
      // Into the section the current page sits in, so "new page" while reading a section lands there
      // rather than at the root — which is the only guess this screen makes and the one everybody
      // expects it to.
      wiki.addPage.mutate(
        { title: title.trim(), categoryId: page.data?.categoryId ?? null },
        { onSuccess: (created) => setSelectedPageId(created.id) },
      )
    }
  }

  function removeSection(category: CategoryNode) {
    // No confirmation, deliberately: the server refuses a section that holds anything, so the only
    // removal that can succeed is one that destroys nothing.
    wiki.removeSection.mutate(category.id)
  }

  function removePage() {
    if (page.data && window.confirm(`Delete “${page.data.title}”? There is no version history — this is permanent.`)) {
      wiki.removePage.mutate(page.data.id, { onSuccess: () => setSelectedPageId(null) })
    }
  }

  if (wiki.categories.isLoading || wiki.pages.isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  if (categories.length === 0 && pages.length === 0 && !debouncedSearch) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t("wiki.empty.title", "This project has no wiki yet")}
        message={t(
          "wiki.empty.message",
          "A wiki is for what is not a work item — the project's conventions, a runbook, a decision that outlived the ticket that made it.",
        )}
        action={
          canWrite ? (
            <Button size="sm" className="mt-2" onClick={addPage}>
              <Plus className="size-4" />
              {t("wiki.empty.action", "Write the first page")}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <aside className="space-y-3 lg:border-r lg:pr-4">
        <SearchInput value={search} onChange={setSearch} placeholder={t("wiki.search", "Search the wiki…")} />

        {canWrite && (
          <Button size="sm" variant="outline" className="w-full justify-start" onClick={addPage}>
            <Plus className="size-4" />
            {t("wiki.newPage", "New page")}
          </Button>
        )}

        <WikiTree
          categories={categories}
          pages={pages}
          selectedPageId={selectedPageId}
          onSelectPage={setSelectedPageId}
          canManageSections={canManageSections}
          onAddSection={addSection}
          onRenameSection={(category, name) =>
            wiki.renameSection.mutate({ categoryId: category.id, request: { name } })
          }
          onMoveSection={(category, parentId, position) =>
            wiki.moveSection.mutate({ categoryId: category.id, request: { parentId, position } })
          }
          onRemoveSection={removeSection}
        />
      </aside>

      <section className="min-w-0">
        {selectedPageId === null ? (
          // An empty answer to a search is not an empty wiki — the pages are there, this slice of them
          // is not, and saying so beats a blank pane that reads as a failed load.
          <p className="rounded-lg border bg-muted/20 px-3 py-10 text-center text-sm text-muted-foreground">
            {debouncedSearch
              ? t("wiki.none.search", "No page mentions that.")
              : t("wiki.none.selected", "Pick a page from the list.")}
          </p>
        ) : (
          <WikiDocument
            projectId={projectId}
            page={page.data}
            isLoading={page.isLoading}
            categories={categories}
            canWrite={canWrite}
            isSaving={wiki.savePage.isPending}
            onSave={(title, markdown) =>
              wiki.savePage.mutate({ pageId: selectedPageId, request: { title, contentMarkdown: markdown } })
            }
            onFile={(categoryId) => wiki.filePage.mutate({ pageId: selectedPageId, categoryId })}
            onDelete={removePage}
          />
        )}
      </section>
    </div>
  )
}

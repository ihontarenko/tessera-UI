import { useEffect, useState } from "react"
import { AlertTriangle, BookOpen, ExternalLink, Plus } from "lucide-react"
import { Alert, AlertDescription, Button, Skeleton } from "@jmouse/ui"
import { EmptyState } from "@/components/EmptyState"
import { SearchInput } from "@/components/SearchInput"
import { WikiDocument } from "@/components/wiki/WikiDocument"
import { WikiTree } from "@/components/wiki/WikiTree"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useKiwiPage, useKiwiWiki } from "@/hooks/useKiwiWiki"
import { useLanguage } from "@/context/LanguageContext"

/**
 * The Wiki tab: a tree beside a document — **read from Kiwi** (TSSR-19, TSSR-0097).
 *
 * <h2>⚠️ Tessera stopped owning pages, and this screen is what survived</h2>
 *
 * The anatomy is TSSR-17's and unchanged: sections on the left, one document on the right, the same
 * Markdown stack that draws an issue description. What changed is who answers — the browser calls Kiwi
 * directly with the reader's own Identity token, and **Kiwi decides who may read what** (KW-1 §1).
 * Tessera renders what it was given and holds no opinion about access.
 *
 * <h2>⚠️ Three states, and none of them is a blank pane</h2>
 *
 * | The project… | What this draws |
 * |---|---|
 * | has no section chosen | *"the wiki is not configured"*, pointing at project settings |
 * | has one, Kiwi is up | the wiki |
 * | has one, Kiwi is unreachable | *"Kiwi is down or unreachable"*, and stops |
 *
 * They are told apart **here, in one place**, because "not configured", "not yours" and "down" are
 * three different sentences and the failure mode is drawing the same grey box for all of them. An empty
 * state that reads as *"you have no pages"* while Kiwi is down is worse than an error: it is a
 * plausible lie (KW-1 §12).
 *
 * <h2>⚠️ Section management is gone, deliberately</h2>
 *
 * Creating, renaming, moving and deleting a section happen on **Kiwi's** screens, where the grants that
 * govern them are visible. Offering those controls here would mean offering somebody a button whose
 * refusal this product cannot explain.
 */
export function WikiPanel({
  projectId,
  kiwiRootCategoryId,
  canConfigure,
}: {
  projectId: string
  /** The project's branch of Kiwi's tree, or null where nobody has chosen one (KW-1 §2, §3). */
  kiwiRootCategoryId: string | null
  /** Whether this reader can go and choose one — it changes the sentence, never the access. */
  canConfigure: boolean
}) {
  const { t } = useLanguage()
  const [search, setSearch] = useState("")
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const wiki = useKiwiWiki(kiwiRootCategoryId, debouncedSearch)
  const page = useKiwiPage(selectedPageId)

  const pages = wiki.pages

  // Land on something readable rather than on an empty right-hand side: the first page in the list, and
  // a different one whenever what is selected has stopped existing (deleted, or filtered away by a
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

  if (kiwiRootCategoryId === null) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t("wiki.unconfigured.title", "The wiki is not configured")}
        message={
          canConfigure
            ? t(
                "wiki.unconfigured.admin",
                "This project's pages live in Kiwi, and nobody has said which section of it they live in. Pick one in the project's settings.",
              )
            : t(
                "wiki.unconfigured.member",
                "This project's pages live in Kiwi, and nobody has said which section of it they live in yet. Somebody who administers the project can choose one.",
              )
        }
      />
    )
  }

  // ⚠️ Before the loading check, not after it: a query that failed is not a query still loading, and
  // the order of these two branches is the difference between an honest error and a spinner forever.
  if (wiki.unreachable) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          {t(
            "wiki.down",
            "Kiwi is down or unreachable, so this project's pages cannot be drawn. Nothing is lost — the wiki is stored there, and this tab only reads it.",
          )}
        </AlertDescription>
      </Alert>
    )
  }

  if (wiki.tree.isError || wiki.rootMissing) {
    // ⚠️ Not an error to the reader. Kiwi answering "not yours" about a section is a grant they have
    // not been given, which is somebody's job over there rather than a fault to report here.
    return (
      <EmptyState
        icon={BookOpen}
        title={t("wiki.noAccess.title", "This wiki is not yours to read")}
        message={t(
          "wiki.noAccess.message",
          "The section this project's wiki lives in is in Kiwi, and you have not been granted it. Somebody who administers Kiwi's access can give it to you.",
        )}
      />
    )
  }

  if (wiki.tree.isLoading || wiki.root === null) {
    return <Skeleton className="h-96 w-full" />
  }

  const root = wiki.root
  const writeInto = selectedSectionId ?? root.id

  function addPage() {
    const title = window.prompt("Title of the new page")

    if (title?.trim()) {
      // Into the section being looked at, so "new page" while reading a section lands there rather than
      // at the root — the only guess this screen makes, and the one everybody expects it to.
      wiki.addPage.mutate(
        { categoryId: writeInto, title: title.trim() },
        { onSuccess: (created) => setSelectedPageId(created.id) },
      )
    }
  }

  function removePage() {
    if (
      page.data &&
      window.confirm(`Delete “${page.data.title}”? Its revisions go with it — this is permanent.`)
    ) {
      wiki.removePage.mutate(page.data.id, { onSuccess: () => setSelectedPageId(null) })
    }
  }

  if (pages.length === 0 && !debouncedSearch && !wiki.pagesLoading) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t("wiki.empty.title", "This project has no wiki yet")}
        message={t(
          "wiki.empty.message",
          "A wiki is for what is not a work item — the project's conventions, a runbook, a decision that outlived the ticket that made it.",
        )}
        action={
          <Button size="sm" className="mt-2" onClick={addPage}>
            <Plus className="size-4" />
            {t("wiki.empty.action", "Write the first page")}
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <aside className="space-y-3 lg:border-r lg:pr-4">
        <SearchInput value={search} onChange={setSearch} placeholder={t("wiki.search", "Search the wiki…")} />

        <Button size="sm" variant="outline" className="w-full justify-start" onClick={addPage}>
          <Plus className="size-4" />
          {t("wiki.newPage", "New page")}
        </Button>

        <WikiTree
          root={root}
          pages={pages}
          isSearching={wiki.isSearching}
          selectedPageId={selectedPageId}
          selectedSectionId={selectedSectionId}
          onSelectPage={setSelectedPageId}
          onSelectSection={setSelectedSectionId}
        />

        {/* Where the sections themselves are managed. ⚠️ A link rather than a control: this product
            cannot explain a refusal it did not make. */}
        <a
          href={`${window.location.protocol}//${window.location.hostname}:5070`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-2 pt-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3" />
          {t("wiki.manageInKiwi", "Manage sections in Kiwi")}
        </a>
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
            root={root}
            isSaving={wiki.savePage.isPending}
            onSave={(title, markdown) => wiki.savePage.mutate({ pageId: selectedPageId, title, markdown })}
            onFile={(categoryId) => wiki.filePage.mutate({ pageId: selectedPageId, categoryId })}
            onDelete={removePage}
          />
        )}
      </section>
    </div>
  )
}

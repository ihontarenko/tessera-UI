import { useEffect, useState } from "react"
import { History, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { MarkdownField } from "@/components/markdown/MarkdownField"
import { WikiPageBlockProvider } from "@/components/markdown/liveBlocks"
import { memberName } from "@/lib/memberDisplay"
import { flattenCategories, type CategoryNode, type WikiPageDetail } from "@/api/wiki"

/**
 * One page, read and written in place (TSSR-17).
 *
 * ⚠️ **The renderer is `TesseraMarkdown`, through `MarkdownField`** — the same stack that draws issue
 * descriptions. A second Markdown engine in the same application is how two documents in one product
 * stop looking alike, and the editor here is deliberately whatever that field already gives us: a real
 * toolbar is JMF-11's job, and this screen must not wait on it.
 *
 * ⚠️ **The "no history" warning is on the screen and not in a tooltip.** There is one copy of the text
 * and nothing behind it, so a save destroys what was there. That is ruled rather than overlooked, which
 * makes saying it out loud the only honest option — a person about to overwrite a runbook should learn
 * that before, not after.
 */
export function WikiDocument({
  projectId,
  page,
  isLoading,
  categories,
  canWrite,
  isSaving,
  onSave,
  onFile,
  onDelete,
}: {
  projectId: string
  page: WikiPageDetail | undefined
  isLoading: boolean
  categories: CategoryNode[]
  canWrite: boolean
  isSaving: boolean
  onSave: (title: string, markdown: string) => void
  onFile: (categoryId: string | null) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState("")

  // A save elsewhere — another tab, a tool call — has to win over a title nobody is typing into, and
  // switching pages has to reset it. Keyed on the id as well as the title so both are one rule.
  useEffect(() => {
    setTitle(page?.title ?? "")
  }, [page?.id, page?.title])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!page) {
    return null
  }

  function commitTitle() {
    if (title.trim() && title.trim() !== page?.title) {
      onSave(title.trim(), page?.contentMarkdown ?? "")
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {canWrite ? (
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                (event.target as HTMLInputElement).blur()
              }
              if (event.key === "Escape") {
                setTitle(page.title)
              }
            }}
            className="h-auto border-transparent bg-transparent px-2 py-1 font-display text-xl font-semibold tracking-[-0.02em] shadow-none hover:border-input focus-visible:border-input"
          />
        ) : (
          <h2 className="px-2 font-display text-xl font-semibold tracking-[-0.02em]">{page.title}</h2>
        )}

        <div className="flex flex-wrap items-center gap-2 px-2 text-xs text-muted-foreground">
          {/* A byline, not a member card — `MemberChip` carries an avatar sized for a row and would
              tower over a line of 12px text. */}
          {page.author && <span>Written by {memberName(page.author)}</span>}
          {page.updatedBy && page.updatedBy.id !== page.author?.id && (
            <span>· Last edited by {memberName(page.updatedBy)}</span>
          )}

          {/* Filed where — a select rather than a drag, because the tree is on the other side of the
              screen and a drag between two scroll containers is the interaction people miss. */}
          {canWrite && (
            <select
              className="ml-auto rounded-md border bg-transparent px-2 py-1 text-xs"
              value={page.categoryId ?? ""}
              onChange={(event) => onFile(event.target.value || null)}
            >
              <option value="">Uncategorised</option>
              {flattenCategories(categories).map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {" ".repeat(depth * 3)}
                  {node.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {canWrite && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <History className="mt-0.5 size-3.5 shrink-0 opacity-70" />
          <span>
            This wiki keeps no version history yet — saving replaces what was here, and there is no way
            back. Copy anything you would miss before a large rewrite.
          </span>
        </p>
      )}

      {/* ⚠️ The provider is what makes `:::issue TSSR-4` resolve, and it names the page rather than
          just the project. The server answers a directive only when its exact line appears in that
          page's stored markdown — so the block engine has to be told which page it is looking at, and
          a block typed but not yet saved correctly says so instead of resolving. */}
      <WikiPageBlockProvider projectId={projectId} pageId={page.id}>
        <MarkdownField
          value={page.contentMarkdown ?? ""}
          canEdit={canWrite && !isSaving}
          placeholder="Write the page…"
          emptyText="This page has nothing on it yet."
          onCommit={(markdown) => onSave(title.trim() || page.title, markdown)}
        />
      </WikiPageBlockProvider>

      {canWrite && (
        <div className="flex justify-end border-t pt-3">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            Delete page
          </Button>
        </div>
      )}
    </div>
  )
}

import { useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/helpers"
import type { CategoryNode, WikiPageSummary } from "@/api/wiki"

/**
 * The wiki's left-hand side: sections, and the pages filed into each (TSSR-17).
 *
 * ⚠️ **One tree, and it is the category tree.** A page has no parent of its own (TSSR-5), so nothing
 * here nests a page under a page — a page is a leaf in a section, and moving it is re-filing it. That is
 * the decision this component is shaped by, and it is why there is exactly one recursive type below.
 *
 * ⚠️ **Uncategorised is a section that is not one.** Every page starts filed nowhere, so the bucket has
 * to exist; it is drawn last, carries no controls, and cannot be renamed or removed because there is
 * nothing there to rename. Giving it the same affordances as a real section would be a lie about what it
 * is.
 */
export function WikiTree({
  categories,
  pages,
  selectedPageId,
  onSelectPage,
  canManageSections,
  onAddSection,
  onRenameSection,
  onMoveSection,
  onRemoveSection,
}: {
  categories: CategoryNode[]
  pages: WikiPageSummary[]
  selectedPageId: string | null
  onSelectPage: (pageId: string) => void
  canManageSections: boolean
  onAddSection: (parentId: string | null) => void
  onRenameSection: (category: CategoryNode, name: string) => void
  onMoveSection: (category: CategoryNode, parentId: string | null, position: number) => void
  onRemoveSection: (category: CategoryNode) => void
}) {
  const uncategorised = pages.filter((page) => page.categoryId === null)

  return (
    <div className="space-y-1">
      {categories.map((category, index) => (
        <SectionBranch
          key={category.id}
          category={category}
          parentId={null}
          index={index}
          siblingCount={categories.length}
          depth={0}
          pages={pages}
          selectedPageId={selectedPageId}
          onSelectPage={onSelectPage}
          canManageSections={canManageSections}
          onAddSection={onAddSection}
          onRenameSection={onRenameSection}
          onMoveSection={onMoveSection}
          onRemoveSection={onRemoveSection}
        />
      ))}

      {/* Drawn even when empty while there are sections above it, so "where did my page go" has a
          visible answer. Hidden only when the whole wiki is uncategorised — then it is not a bucket,
          it is just the list. */}
      {(uncategorised.length > 0 || categories.length > 0) && (
        <div className="pt-1">
          {categories.length > 0 && (
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground">
              <Inbox className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">Uncategorised</span>
              <span className="ml-auto text-xs tabular-nums opacity-70">{uncategorised.length}</span>
            </div>
          )}

          <PageList
            pages={uncategorised}
            depth={categories.length > 0 ? 1 : 0}
            selectedPageId={selectedPageId}
            onSelectPage={onSelectPage}
          />
        </div>
      )}

      {canManageSections && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start text-muted-foreground"
          onClick={() => onAddSection(null)}
        >
          <FolderPlus className="size-4" />
          New section
        </Button>
      )}
    </div>
  )
}

/**
 * One section, its subsections and its pages.
 *
 * Collapsed state lives here rather than in the panel: it is per branch, it does not survive a reload,
 * and lifting it would mean the panel holding a map of ids it has no other reason to know about.
 */
function SectionBranch({
  category,
  parentId,
  index,
  siblingCount,
  depth,
  pages,
  selectedPageId,
  onSelectPage,
  canManageSections,
  onAddSection,
  onRenameSection,
  onMoveSection,
  onRemoveSection,
}: {
  category: CategoryNode
  /** Its own parent, carried so a reorder can send the pair the server expects in one call. */
  parentId: string | null
  index: number
  siblingCount: number
  depth: number
  pages: WikiPageSummary[]
  selectedPageId: string | null
  onSelectPage: (pageId: string) => void
  canManageSections: boolean
  onAddSection: (parentId: string | null) => void
  onRenameSection: (category: CategoryNode, name: string) => void
  onMoveSection: (category: CategoryNode, parentId: string | null, position: number) => void
  onRemoveSection: (category: CategoryNode) => void
}) {
  const [open, setOpen] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const own = pages.filter((page) => page.categoryId === category.id)

  function commitRename(name: string) {
    setRenaming(false)

    if (name.trim() && name.trim() !== category.name) {
      onRenameSection(category, name.trim())
    }
  }

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-md pr-1 hover:bg-accent/50"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1.5 text-left text-[13px]"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 opacity-60" />
          )}

          {renaming ? (
            <Input
              autoFocus
              defaultValue={category.name}
              className="h-6 px-1 py-0 text-[13px]"
              onClick={(event) => event.stopPropagation()}
              onBlur={(event) => commitRename(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitRename((event.target as HTMLInputElement).value)
                }
                if (event.key === "Escape") {
                  setRenaming(false)
                }
              }}
            />
          ) : (
            <span className="truncate font-medium">{category.name}</span>
          )}

          {!renaming && (
            <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground">{category.itemCount}</span>
          )}
        </button>

        {canManageSections && !renaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil className="size-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAddSection(category.id)}>
                <FolderPlus className="size-3.5" />
                Add subsection
              </DropdownMenuItem>
              {/* ⚠️ Two buttons rather than a drag, and that is the whole of reordering in this pass.
                  Dragging a branch between parents is the natural gesture and needs a drop target per
                  node plus a spare one per gap — a screen's worth of work that TSSR-17 does not ask
                  for. The endpoint behind these already takes a parent, so arriving at the drag later
                  is a component change and not a new route. */}
              <DropdownMenuItem
                disabled={index === 0}
                onSelect={() => onMoveSection(category, parentId, index - 1)}
              >
                <ArrowUp className="size-3.5" />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === siblingCount - 1}
                onSelect={() => onMoveSection(category, parentId, index + 1)}
              >
                <ArrowDown className="size-3.5" />
                Move down
              </DropdownMenuItem>
              {/* ⚠️ Not guarded here by counting what is inside. The server refuses a section that
                  holds anything and says which — reproducing that rule in the interface would give it
                  two homes and one of them would eventually be wrong. */}
              <DropdownMenuItem variant="destructive" onSelect={() => onRemoveSection(category)}>
                <Trash2 className="size-3.5" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {open && (
        <>
          <PageList pages={own} depth={depth + 1} selectedPageId={selectedPageId} onSelectPage={onSelectPage} />

          {category.children.map((child, childIndex) => (
            <SectionBranch
              key={child.id}
              category={child}
              parentId={category.id}
              index={childIndex}
              siblingCount={category.children.length}
              depth={depth + 1}
              pages={pages}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              canManageSections={canManageSections}
              onAddSection={onAddSection}
              onRenameSection={onRenameSection}
              onMoveSection={onMoveSection}
              onRemoveSection={onRemoveSection}
            />
          ))}
        </>
      )}
    </div>
  )
}

function PageList({
  pages,
  depth,
  selectedPageId,
  onSelectPage,
}: {
  pages: WikiPageSummary[]
  depth: number
  selectedPageId: string | null
  onSelectPage: (pageId: string) => void
}) {
  return (
    <>
      {pages.map((page) => (
        <button
          key={page.id}
          type="button"
          // The inverted active state Innoventa's sidebar uses, and the one every other list in this
          // product uses — a selected row is the accent, not a tint of it.
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px] transition-colors",
            page.id === selectedPageId
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
          style={{ paddingLeft: `${depth * 12 + 22}px` }}
          onClick={() => onSelectPage(page.id)}
        >
          <FileText className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{page.title}</span>
        </button>
      ))}
    </>
  )
}

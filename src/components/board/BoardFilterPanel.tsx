import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, Copy, Filter, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BoardFilterEditor } from "@/components/board/BoardFilterEditor"
import { useLanguage } from "@/context/LanguageContext"
import { apiErrorMessage } from "@/api/errors"
import { cn } from "@/lib/helpers"
import { deleteSavedFilter, fetchSavedFilters, type SavedFilterView } from "@/api/savedFilters"

/**
 * The board's saved-filter picker: the shipped presets, whatever the project shares, and the member's
 * own filters — one list, grouped by where each came from.
 *
 * Applying one hands its expression to the same `?filter=` the toggles use, so a saved filter and a
 * quick filter are the same mechanism with different authorship. A preset cannot be edited (nobody owns
 * it), so "copy" opens the editor pre-filled instead — using a built-in as a starting point is the
 * common case and does not deserve a separate flow.
 */
export function BoardFilterPanel({
  projectId,
  appliedFilter,
  toggleExpression,
  onApply,
}: {
  projectId: string
  appliedFilter: SavedFilterView | null
  /** The active toggles as one predicate, so "save current" can capture what is on screen. */
  toggleExpression: string | null
  onApply: (savedFilter: SavedFilterView | null) => void
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<SavedFilterView | null>(null)
  const [seedExpression, setSeedExpression] = useState("")

  const { data: savedFilters } = useQuery({
    queryKey: ["saved-filters", projectId],
    queryFn: () => fetchSavedFilters(projectId),
  })

  const deleteMutation = useMutation({
    mutationFn: (savedFilterId: string) => deleteSavedFilter(projectId, savedFilterId),
    onSuccess: (_result, savedFilterId) => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters", projectId] })

      if (appliedFilter?.id === savedFilterId) {
        onApply(null)
      }
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, t("filter.panel.deleteFailed", "Could not delete the filter"))),
  })

  const presets = (savedFilters ?? []).filter((filter) => filter.visibility === "GLOBAL")
  const shared = (savedFilters ?? []).filter((filter) => filter.visibility === "PROJECT")
  const mine = (savedFilters ?? []).filter((filter) => filter.visibility === "PRIVATE")

  function openEditor(savedFilter: SavedFilterView | null, expression: string) {
    setEditing(savedFilter)
    setSeedExpression(expression)
    setEditorOpen(true)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant={appliedFilter ? "default" : "outline"} className="h-8">
            <Filter className="mr-1.5 size-3.5" />
            {appliedFilter ? appliedFilter.name : t("filter.panel.trigger", "Filters")}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          {appliedFilter && (
            <>
              <DropdownMenuItem onClick={() => onApply(null)}>
                <X className="mr-2 size-3.5" />
                {t("filter.panel.clear", "Clear filter")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <FilterGroup
            title={t("filter.panel.presets", "Presets")}
            filters={presets}
            appliedFilter={appliedFilter}
            onApply={onApply}
            onCopy={(preset) => openEditor(null, preset.expression)}
            onEdit={null}
            onDelete={null}
          />

          <FilterGroup
            title={t("filter.panel.shared", "Shared with the project")}
            filters={shared}
            appliedFilter={appliedFilter}
            onApply={onApply}
            onCopy={(filter) => openEditor(null, filter.expression)}
            onEdit={(filter) => openEditor(filter, filter.expression)}
            onDelete={(filter) => deleteMutation.mutate(filter.id)}
          />

          <FilterGroup
            title={t("filter.panel.mine", "My filters")}
            filters={mine}
            appliedFilter={appliedFilter}
            onApply={onApply}
            onCopy={(filter) => openEditor(null, filter.expression)}
            onEdit={(filter) => openEditor(filter, filter.expression)}
            onDelete={(filter) => deleteMutation.mutate(filter.id)}
          />

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => openEditor(null, toggleExpression ?? "")}>
            <Plus className="mr-2 size-3.5" />
            {toggleExpression
              ? t("filter.panel.saveCurrent", "Save current as filter")
              : t("filter.panel.create", "New filter")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BoardFilterEditor
        projectId={projectId}
        savedFilter={editing}
        initialExpression={seedExpression}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={onApply}
      />
    </>
  )
}

function FilterGroup({
  title,
  filters,
  appliedFilter,
  onApply,
  onCopy,
  onEdit,
  onDelete,
}: {
  title: string
  filters: SavedFilterView[]
  appliedFilter: SavedFilterView | null
  onApply: (savedFilter: SavedFilterView) => void
  onCopy: (savedFilter: SavedFilterView) => void
  /** `null` when nothing in this group can be changed — the presets. */
  onEdit: ((savedFilter: SavedFilterView) => void) | null
  onDelete: ((savedFilter: SavedFilterView) => void) | null
}) {
  if (filters.length === 0) {
    return null
  }

  return (
    <>
      <DropdownMenuLabel className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {title}
      </DropdownMenuLabel>

      {filters.map((filter) => {
        const applied = appliedFilter?.id === filter.id

        return (
          <DropdownMenuItem
            key={filter.id}
            // The row actions are buttons inside the item, so the menu must not close on their click.
            onSelect={(event) => event.preventDefault()}
            onClick={() => onApply(filter)}
            className={cn("group justify-between gap-2", applied && "bg-accent")}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Check className={cn("size-3.5 shrink-0", applied ? "opacity-100" : "opacity-0")} />
              <span className="truncate" title={filter.description ?? filter.expression}>
                {filter.name}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100">
              <RowAction label="Copy" onClick={() => onCopy(filter)}>
                <Copy className="size-3" />
              </RowAction>

              {onEdit && filter.editable && (
                <RowAction label="Edit" onClick={() => onEdit(filter)}>
                  <Pencil className="size-3" />
                </RowAction>
              )}

              {onDelete && filter.editable && (
                <RowAction label="Delete" onClick={() => onDelete(filter)}>
                  <Trash2 className="size-3 text-destructive" />
                </RowAction>
              )}
            </span>
          </DropdownMenuItem>
        )
      })}
    </>
  )
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded p-1 hover:bg-background"
      onClick={(event) => {
        // Without this the row's own onClick would also fire and apply the filter being deleted.
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

import { Rows3 } from "lucide-react"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jmouse/ui"
import type { BoardFilter } from "@/components/board/boardFilters"
import { BoardFilterPanel } from "@/components/board/BoardFilterPanel"
import { SWIMLANE_LABEL } from "@/components/board/swimlanes"
import type { SavedFilterView } from "@/api/savedFilters"
import { useLanguage } from "@/context/LanguageContext"
import type { SwimlaneStrategy } from "@/api/boards"
import { cn } from "@/lib/helpers"
import { resolveText } from "@/lib/translatableText"

const SWIMLANE_STRATEGIES: SwimlaneStrategy[] = ["NONE", "ASSIGNEE", "EPIC", "PRIORITY"]

/**
 * The board's view controls: the swimlane selector (ticket 04) and the quick-filter toggles.
 *
 * The two differ in scope on purpose. The swimlane strategy is a property of the *board* — every
 * viewer sees the same grouping — so it persists and only an administrator may change it; everyone
 * else sees the current choice, disabled. A quick filter is per-viewer: it is evaluated server-side as
 * jME (ADR-0008) but never stored, so turning one on changes what this member sees and nothing else.
 *
 * The toggles arrive as data rather than being listed here, so the set of built-in filters is the
 * backend's to change.
 */
export function BoardToolbar({
  projectId,
  swimlaneStrategy,
  canChangeSwimlanes,
  onSwimlaneChange,
  filters,
  activeFilterIds,
  onToggleFilter,
  appliedFilter,
  toggleExpression,
  onApplyFilter,
}: {
  projectId: string
  swimlaneStrategy: SwimlaneStrategy
  canChangeSwimlanes: boolean
  onSwimlaneChange: (strategy: SwimlaneStrategy) => void
  filters: BoardFilter[]
  activeFilterIds: string[]
  onToggleFilter: (filterId: string) => void
  /** The saved filter currently applied, narrowing alongside the toggles. */
  appliedFilter: SavedFilterView | null
  /** The active toggles as one predicate, so the panel can offer to save what is on screen. */
  toggleExpression: string | null
  onApplyFilter: (savedFilter: SavedFilterView | null) => void
}) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={swimlaneStrategy}
        onValueChange={(value) => onSwimlaneChange(value as SwimlaneStrategy)}
        disabled={!canChangeSwimlanes}
      >
        <SelectTrigger
          className="h-8 w-44"
          title={
            canChangeSwimlanes
              ? undefined
              : t("board.swimlane.lockedHint", "Only project administrators can change the grouping")
          }
        >
          <Rows3 className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SWIMLANE_STRATEGIES.map((strategy) => (
            <SelectItem key={strategy} value={strategy}>
              {resolveText(t, SWIMLANE_LABEL[strategy])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <BoardFilterPanel
        projectId={projectId}
        appliedFilter={appliedFilter}
        toggleExpression={toggleExpression}
        onApply={onApplyFilter}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((filter) => {
          const active = activeFilterIds.includes(filter.id)
          return (
            <Button
              key={filter.id}
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => onToggleFilter(filter.id)}
              className={cn("h-8", !active && "text-muted-foreground")}
            >
              {resolveText(t, filter.label)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

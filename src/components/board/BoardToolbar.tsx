import { Rows3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QUICK_FILTERS } from "@/components/board/boardFilters"
import { SWIMLANE_LABEL } from "@/components/board/swimlanes"
import type { SwimlaneStrategy } from "@/api/boards"
import { cn } from "@/lib/helpers"

const SWIMLANE_STRATEGIES: SwimlaneStrategy[] = ["NONE", "ASSIGNEE", "EPIC", "PRIORITY"]

/**
 * The board's view controls: the swimlane selector (ticket 04) and the stub quick-filter toggles
 * (ticket 05).
 *
 * The two differ in scope on purpose. The swimlane strategy is a property of the *board* — every
 * viewer sees the same grouping — so it persists and only an administrator may change it; everyone
 * else sees the current choice, disabled. The quick filters are per-viewer and never leave the client.
 */
export function BoardToolbar({
  swimlaneStrategy,
  canChangeSwimlanes,
  onSwimlaneChange,
  activeFilterIds,
  onToggleFilter,
}: {
  swimlaneStrategy: SwimlaneStrategy
  canChangeSwimlanes: boolean
  onSwimlaneChange: (strategy: SwimlaneStrategy) => void
  activeFilterIds: string[]
  onToggleFilter: (filterId: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={swimlaneStrategy}
        onValueChange={(value) => onSwimlaneChange(value as SwimlaneStrategy)}
        disabled={!canChangeSwimlanes}
      >
        <SelectTrigger
          className="h-8 w-44"
          title={canChangeSwimlanes ? undefined : "Only project administrators can change the grouping"}
        >
          <Rows3 className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SWIMLANE_STRATEGIES.map((strategy) => (
            <SelectItem key={strategy} value={strategy}>
              {SWIMLANE_LABEL[strategy]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_FILTERS.map((filter) => {
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
              {filter.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2, X } from "lucide-react"
import { Badge, Button, Input } from "@jmouse/ui"
import { InlineSelect } from "@/components/inline/InlineSelect"
import { InlineTextField } from "@/components/inline/InlineTextField"
import {
  clearColumnFallback,
  createColumn,
  deleteColumn,
  mapColumnStatus,
  reorderColumn,
  setColumnFallback,
  setDoneThreshold,
  setScopeStrategy,
  unmapColumnStatus,
  updateColumn,
  type BoardColumnView,
  type BoardResponse,
} from "@/api/boards"
import type { BoardScopeStrategy } from "@/api/sprints"
import { fetchCatalog, type StatusCategory } from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/helpers"
import { resolveText, type TranslatableText } from "@/lib/translatableText"

const NO_FALLBACK = "__none__"
const CHOOSE_STATUS = "__choose__"

/** Offered in this order deliberately: the plainer board first, sprints as the step up from it. */
const SCOPE_STRATEGIES: BoardScopeStrategy[] = ["ALL_ISSUES", "ACTIVE_SPRINT"]

/**
 * What each scope strategy is called and what choosing it does — one table rather than the same
 * two-branch ternary written out at each of the three places (ticket 08).
 */
const SCOPE_STRATEGY_COPY: Record<
  BoardScopeStrategy,
  { option: TranslatableText; consequence: TranslatableText; confirmation: TranslatableText }
> = {
  ALL_ISSUES: {
    option: { key: "board.settings.scope.allIssues", text: "Every issue in the project" },
    consequence: { key: "board.settings.scope.allIssues.consequence", text: "No Reports tab." },
    confirmation: { key: "board.settings.scope.switchedToAllIssues", text: "The board now shows every issue" },
  },
  ACTIVE_SPRINT: {
    option: { key: "board.settings.scope.activeSprint", text: "Only the active sprint" },
    consequence: {
      key: "board.settings.scope.activeSprint.consequence",
      text: "The Reports tab appears. A running sprint is never altered by switching either way.",
    },
    confirmation: { key: "board.settings.scope.switchedToSprint", text: "The board now shows the active sprint" },
  },
}

/** The three workflow categories, as UI copy — unlike a status *name*, which an administrator authors. */
const CATEGORY_LABEL: Record<StatusCategory, TranslatableText> = {
  TODO: { key: "board.category.todo", text: "To Do" },
  IN_PROGRESS: { key: "board.category.inProgress", text: "In Progress" },
  DONE: { key: "board.category.done", text: "Done" },
}

/**
 * Board configuration (Phase-2 tickets 03/06, Phase-3 ticket 08, {@code ADMINISTER_PROJECT}): what the
 * board shows, how its columns are shaped, which statuses they hold, their WIP bounds and the
 * done-threshold.
 *
 * Rewritten to be read at a glance. It used to be a column of bordered cards, each carrying an edit
 * mode, a Save and a Cancel — four columns filled a screen and a half and the board's own two settings
 * were lost above them. A column is one row now: name, what it holds, its bounds, and a disclosure for
 * the status mappings, which are the only part that needs room. Nothing has a Save button; a field
 * commits when it loses focus, exactly as an issue's fields do.
 *
 * The panel has one home — Settings › Board. It had two until the board grew a sheet of its own over
 * the same component, which meant every question about the board had two right answers and either
 * surface could quietly gain a control the other lacked; the board keeps a button, and the button now
 * navigates here.
 */
export function BoardSettingsPanel({ projectId, board }: { projectId: string; board: BoardResponse }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })

  const columns = [...board.columns].sort((first, second) => first.position - second.position)
  const mappedStatusIds = new Set(columns.flatMap((column) => column.explicitStatusIds))

  const [newColumnName, setNewColumnName] = useState("")

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["board", projectId] })
  }

  function onMutationError(error: unknown, fallback: string) {
    toast.error(apiErrorMessage(error, fallback))
  }

  const createMutation = useMutation({
    mutationFn: () => createColumn(projectId, { name: newColumnName.trim() }),
    onSuccess: () => {
      invalidate()
      setNewColumnName("")
    },
    onError: (error) => onMutationError(error, t("board.error.createColumn", "Could not create the column")),
  })

  const reorderMutation = useMutation({
    mutationFn: (variables: { columnId: string; position: number }) =>
      reorderColumn(projectId, variables.columnId, variables.position),
    onSuccess: invalidate,
    onError: (error) => onMutationError(error, t("board.error.reorderColumn", "Could not reorder the column")),
  })

  const deleteMutation = useMutation({
    mutationFn: (columnId: string) => deleteColumn(projectId, columnId),
    onSuccess: invalidate,
    onError: (error) => onMutationError(error, t("board.error.deleteColumn", "Could not delete the column")),
  })

  const fallbackMutation = useMutation({
    mutationFn: async (variables: { columnId: string; category: StatusCategory | null }) => {
      if (variables.category) {
        await setColumnFallback(projectId, variables.columnId, variables.category)
      } else {
        await clearColumnFallback(projectId, variables.columnId)
      }
    },
    onSuccess: invalidate,
    onError: (error) => onMutationError(error, t("board.error.fallback", "Could not change the fallback column")),
  })

  const mapStatusMutation = useMutation({
    mutationFn: (variables: { columnId: string; statusId: string }) =>
      mapColumnStatus(projectId, variables.columnId, variables.statusId),
    onSuccess: invalidate,
    onError: (error) => onMutationError(error, t("board.error.mapStatus", "Could not map the status")),
  })

  const unmapStatusMutation = useMutation({
    mutationFn: (variables: { columnId: string; statusId: string }) =>
      unmapColumnStatus(projectId, variables.columnId, variables.statusId),
    onSuccess: invalidate,
    onError: (error) => onMutationError(error, t("board.error.unmapStatus", "Could not unmap the status")),
  })

  function moveColumn(column: BoardColumnView, direction: -1 | 1) {
    const index = columns.findIndex((entry) => entry.id === column.id)
    const targetIndex = index + direction

    if (targetIndex < 0 || targetIndex >= columns.length) {
      return
    }

    reorderMutation.mutate({ columnId: column.id, position: targetIndex })
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <SettingRow label={t("board.settings.scope.label", "Shows")}>
          <ScopeStrategyField projectId={projectId} board={board} />
        </SettingRow>
        <SettingRow label={t("board.settings.doneThreshold.short", "Hide done")}>
          <DoneThresholdField projectId={projectId} board={board} />
        </SettingRow>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("board.settings.columns", "Columns")} · {columns.length}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border">
          {columns.map((column, index) => (
            <ColumnRow
              key={column.id}
              projectId={projectId}
              column={column}
              isFirst={index === 0}
              isLast={index === columns.length - 1}
              statuses={catalog?.statuses ?? []}
              mappedElsewhere={mappedStatusIds}
              onMoveUp={() => moveColumn(column, -1)}
              onMoveDown={() => moveColumn(column, 1)}
              onDelete={() => deleteMutation.mutate(column.id)}
              onSetFallback={(category) => fallbackMutation.mutate({ columnId: column.id, category })}
              onMapStatus={(statusId) => mapStatusMutation.mutate({ columnId: column.id, statusId })}
              onUnmapStatus={(statusId) => unmapStatusMutation.mutate({ columnId: column.id, statusId })}
            />
          ))}

          <div className="flex items-center gap-2 border-t bg-muted/30 p-1.5">
            <Input
              value={newColumnName}
              onChange={(event) => setNewColumnName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newColumnName.trim()) {
                  createMutation.mutate()
                }
              }}
              placeholder={t("board.settings.columnNamePlaceholder", "New column…")}
              maxLength={128}
              className="h-7 border-transparent bg-transparent shadow-none focus-visible:border-input"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 px-2"
              disabled={newColumnName.trim().length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <Plus className="size-3.5" />
              {t("common.add", "Add")}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t(
            "board.settings.backlogHint",
            "A status no column holds is in the backlog. That is where the board ends and the backlog begins.",
          )}
        </p>
      </section>
    </div>
  )
}

/** Label left, control right — the same shape the issue rail uses, so settings read the same way. */
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * The scope strategy (Phase-3 ticket 08): whether this project does Scrum. One field decides both what
 * the board draws from and whether the Reports tab exists (ADR-0012) — nothing branches on the
 * project's *type*, which is why changing process is this control rather than a migration. The backlog
 * is not among the consequences: every project has one (ADR-0016).
 *
 * Only the chosen option's consequence is spelled out. Both used to be listed at once, which was
 * honest and cost four lines to say what one line says at the moment it matters.
 */
function ScopeStrategyField({ projectId, board }: { projectId: string; board: BoardResponse }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const scopeMutation = useMutation({
    mutationFn: (strategy: BoardScopeStrategy) => setScopeStrategy(projectId, strategy),
    onSuccess: (settings) => {
      for (const queryKey of [["board", projectId], ["project", projectId], ["projects"], ["backlog", projectId]]) {
        void queryClient.invalidateQueries({ queryKey })
      }
      toast.success(resolveText(t, SCOPE_STRATEGY_COPY[settings.scopeStrategy].confirmation))
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, t("board.error.scope", "Could not change what the board shows"))),
  })

  return (
    <div className="space-y-0.5">
      <InlineSelect
        ariaLabel={t("board.settings.scope.label", "This board shows")}
        className="rounded-md border"
        value={board.scopeStrategy}
        disabled={scopeMutation.isPending}
        options={SCOPE_STRATEGIES.map((strategy) => ({
          value: strategy,
          label: resolveText(t, SCOPE_STRATEGY_COPY[strategy].option),
        }))}
        onChange={(value) => scopeMutation.mutate(value as BoardScopeStrategy)}
      />
      <p className="text-xs text-muted-foreground">
        {resolveText(t, SCOPE_STRATEGY_COPY[board.scopeStrategy].consequence)}
      </p>
    </div>
  )
}

/** A blank box means "never drop completed issues"; anything else must be a whole, non-negative number
 *  of days. Rejected input reverts rather than posting a `NaN` the server would store as "never". */
function isThreshold(days: string): boolean {
  if (days.trim().length === 0) {
    return true
  }

  const parsed = Number(days)

  return Number.isInteger(parsed) && parsed >= 0
}

/** The done-threshold (ticket 06): how many days a completed issue stays on the board. Measured against
 *  the issue's recorded completion time, so editing a done issue does not bring it back. */
function DoneThresholdField({ projectId, board }: { projectId: string; board: BoardResponse }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const thresholdMutation = useMutation({
    mutationFn: (value: number | null) => setDoneThreshold(projectId, value),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["board", projectId] }),
    onError: (error) =>
      toast.error(apiErrorMessage(error, t("board.error.doneThreshold", "Could not update the done-threshold"))),
  })

  return (
    <div className="flex items-center gap-2">
      <InlineTextField
        ariaLabel={t("board.settings.doneThreshold.label", "Hide completed issues older than")}
        value={board.hideDoneOlderThanDays != null ? String(board.hideDoneOlderThanDays) : ""}
        canEdit
        accepts={isThreshold}
        placeholder={t("board.settings.doneThreshold.never", "never")}
        className="h-7 w-20 tabular-nums"
        onCommit={(next) => thresholdMutation.mutate(next.trim().length === 0 ? null : Number(next))}
      />
      <span className="text-xs text-muted-foreground">
        {t("board.settings.doneThreshold.daysHint", "days · blank keeps them forever")}
      </span>
    </div>
  )
}

/**
 * One column, one row. The disclosure holds the status mappings — the only part of a column that needs
 * room, and the part most columns never touch, since a category fallback already covers them.
 */
function ColumnRow({
  projectId,
  column,
  isFirst,
  isLast,
  statuses,
  mappedElsewhere,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSetFallback,
  onMapStatus,
  onUnmapStatus,
}: {
  projectId: string
  column: BoardColumnView
  isFirst: boolean
  isLast: boolean
  statuses: Array<{ id: string; name: string; category: StatusCategory }>
  mappedElsewhere: Set<string>
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onSetFallback: (category: StatusCategory | null) => void
  onMapStatus: (statusId: string) => void
  onUnmapStatus: (statusId: string) => void
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (changes: { name?: string; minIssues?: number | null; maxIssues?: number | null }) =>
      updateColumn(projectId, column.id, {
        name: column.name,
        minIssues: column.minIssues,
        maxIssues: column.maxIssues,
        ...changes,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["board", projectId] }),
    onError: (error) => toast.error(apiErrorMessage(error, t("board.error.updateColumn", "Could not update the column"))),
  })

  const statusById = new Map(statuses.map((status) => [status.id, status]))
  const availableStatuses = statuses.filter((status) => !mappedElsewhere.has(status.id))
  const holdsNothing = column.fallbackForCategory == null && column.explicitStatusIds.length === 0

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-1.5 p-1.5">
        <div className="flex flex-col">
          <button
            type="button"
            disabled={isFirst}
            onClick={onMoveUp}
            className="text-muted-foreground hover:text-foreground disabled:opacity-25"
            aria-label={t("board.settings.moveColumnUp", "Move column up")}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={onMoveDown}
            className="text-muted-foreground hover:text-foreground disabled:opacity-25"
            aria-label={t("board.settings.moveColumnDown", "Move column down")}
          >
            <ChevronDown className="size-3" />
          </button>
        </div>

        <InlineTextField
          ariaLabel={t("board.settings.columnName", "Column name")}
          value={column.name}
          canEdit
          required
          maximumLength={128}
          className="h-7 min-w-0 flex-1 font-medium"
          onCommit={(name) => updateMutation.mutate({ name })}
        />

        <InlineSelect
          ariaLabel={t("board.settings.fallbackFor", "Holds")}
          className="w-36 shrink-0"
          value={column.fallbackForCategory ?? NO_FALLBACK}
          options={[
            { value: NO_FALLBACK, label: t("board.settings.fallbackNone", "Mapped statuses only") },
            ...(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((category) => ({
              value: category,
              label: `${t("board.settings.allOf", "All")} ${resolveText(t, CATEGORY_LABEL[category])}`,
            })),
          ]}
          onChange={(value) => onSetFallback(value === NO_FALLBACK ? null : (value as StatusCategory))}
        />

        <div className="flex shrink-0 items-center gap-1" title={t("board.settings.wip", "WIP bounds")}>
          <BoundField
            ariaLabel={t("board.settings.minIssues", "Minimum issues")}
            value={column.minIssues}
            onCommit={(minIssues) => updateMutation.mutate({ minIssues })}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <BoundField
            ariaLabel={t("board.settings.maxIssues", "Maximum issues")}
            value={column.maxIssues}
            onCommit={(maxIssues) => updateMutation.mutate({ maxIssues })}
          />
        </div>

        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-accent",
            holdsNothing ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground",
          )}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {column.explicitStatusIds.length > 0
            ? t("board.settings.statusCount", "{count} statuses", { count: column.explicitStatusIds.length })
            : t("board.settings.noStatuses", "no statuses")}
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive-ink"
          aria-label={t("common.delete", "Delete")}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 border-t bg-muted/20 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1">
            {column.explicitStatusIds.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {t("board.settings.noExplicitStatuses", "None — this column holds whatever its category covers.")}
              </span>
            )}
            {column.explicitStatusIds.map((statusId) => (
              <Badge key={statusId} variant="secondary" className="gap-1 pr-1">
                {statusById.get(statusId)?.name ?? statusId}
                <button
                  type="button"
                  onClick={() => onUnmapStatus(statusId)}
                  aria-label={t("board.settings.unmapStatus", "Unmap status")}
                  className="rounded-sm hover:bg-background/60"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>

          {availableStatuses.length > 0 && (
            <InlineSelect
              ariaLabel={t("board.settings.mapStatus", "Map a status")}
              className="w-56 rounded-md border"
              value={CHOOSE_STATUS}
              options={[
                { value: CHOOSE_STATUS, label: t("board.settings.mapStatus", "Map a status…") },
                ...availableStatuses.map((status) => ({ value: status.id, label: status.name })),
              ]}
              onChange={onMapStatus}
            />
          )}

          {/* Where the board ends and the backlog begins is exactly this choice (ADR-0016), so it says
              so at the moment it is being made rather than leaving the work to look lost. */}
          {holdsNothing && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t(
                "board.settings.fallbackNoneHint",
                "This column holds nothing. Statuses no column maps appear in the backlog instead.",
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** A WIP bound: blank means unbounded, and anything that is not a whole number reverts. */
function BoundField({
  ariaLabel,
  value,
  onCommit,
}: {
  ariaLabel: string
  value: number | null | undefined
  onCommit: (value: number | null) => void
}) {
  return (
    <InlineTextField
      ariaLabel={ariaLabel}
      value={value != null ? String(value) : ""}
      canEdit
      placeholder="—"
      className="h-7 w-10 px-1 text-center tabular-nums"
      accepts={(next) => next.trim().length === 0 || (Number.isInteger(Number(next)) && Number(next) >= 0)}
      onCommit={(next) => onCommit(next.trim().length === 0 ? null : Number(next))}
    />
  )
}

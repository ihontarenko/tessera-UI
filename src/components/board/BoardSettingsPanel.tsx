import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
 * What each scope strategy is called, what choosing it does, and what to say once it is chosen — one
 * table rather than the same two-branch ternary written out at each of the three places (ticket 08).
 */
const SCOPE_STRATEGY_COPY: Record<
  BoardScopeStrategy,
  { option: TranslatableText; consequence: TranslatableText; confirmation: TranslatableText }
> = {
  ALL_ISSUES: {
    option: { key: "board.settings.scope.allIssues", text: "Every issue in the project" },
    consequence: {
      key: "board.settings.scope.allIssues.consequence",
      text: "— the whole project on the board, with no Reports tab.",
    },
    confirmation: { key: "board.settings.scope.switchedToAllIssues", text: "The board now shows every issue" },
  },
  ACTIVE_SPRINT: {
    option: { key: "board.settings.scope.activeSprint", text: "Only the active sprint" },
    consequence: {
      key: "board.settings.scope.activeSprint.consequence",
      text: "— the running sprint only, and the Reports tab appears. A running sprint is never altered by switching either way.",
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
 * Board configuration (Phase-2 tickets 03/06, Phase-3 ticket 08, {@code ADMINISTER_PROJECT}): choose
 * what the board shows, reshape columns, set WIP limits, assign which column backs each status
 * category, override individual status→column mappings, and set the done-threshold.
 *
 * This is the panel itself, with no surface of its own, because it has two homes: Settings › Board and
 * the sheet the board opens as a shortcut (ticket 06). Both mutate through the same shared board query,
 * so whichever one is open shows the other's edits — there is one state, rendered twice, not two copies
 * that have to be kept in agreement.
 */
export function BoardSettingsPanel({ projectId, board }: { projectId: string; board: BoardResponse }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const boardKey = ["board", projectId]
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: boardKey })
  }

  function onMutationError(error: unknown, fallback: string) {
    toast.error(apiErrorMessage(error, fallback))
  }

  const columns = [...board.columns].sort((first, second) => first.position - second.position)
  const mappedStatusIds = new Set(columns.flatMap((column) => column.explicitStatusIds))

  const [newColumnName, setNewColumnName] = useState("")
  const createMutation = useMutation({
    mutationFn: () => createColumn(projectId, { name: newColumnName.trim() }),
    onSuccess: () => {
      invalidate()
      setNewColumnName("")
      toast.success(t("board.settings.columnCreated", "Column created"))
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
    onSuccess: () => {
      invalidate()
      toast.success(t("board.settings.columnDeleted", "Column deleted"))
    },
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
    <div className="flex flex-col gap-4">
      <ScopeStrategyRow projectId={projectId} board={board} />

      <Separator />

      <DoneThresholdRow projectId={projectId} board={board} />

      <Separator />

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">{t("board.settings.newColumn", "New column")}</Label>
          <Input
            value={newColumnName}
            onChange={(event) => setNewColumnName(event.target.value)}
            placeholder={t("board.settings.columnNamePlaceholder", "Column name")}
            maxLength={128}
          />
        </div>
        <Button
          size="sm"
          disabled={newColumnName.trim().length === 0 || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {t("common.add", "Add")}
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
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
      </div>
    </div>
  )
}

/**
 * The scope strategy (Phase-3 ticket 08): whether this project does Scrum. One field decides both what
 * the board draws from and whether the Reports tab exists (ADR-0012) — nothing branches on the
 * project's *type*, which is why changing process is this control rather than a migration. The backlog
 * is not among the consequences: every project has one (ADR-0016).
 *
 * Each option carries its consequence in one line, because the consequence — a tab appearing or
 * disappearing, and the board's whole contents changing — is a great deal larger than a two-item select
 * looks. Switching away from sprint scope changes only what is rendered: a running sprint keeps running
 * and comes back untouched.
 *
 * Four caches follow the change: the board itself, the project (whose scope strategy drives the tab
 * list), the projects list and the backlog. Invalidating them is what makes the tab appear and
 * disappear immediately, with no reload.
 */
function ScopeStrategyRow({ projectId, board }: { projectId: string; board: BoardResponse }) {
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
    onError: (error) => toast.error(apiErrorMessage(error, t("board.error.scope", "Could not change what the board shows"))),
  })

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{t("board.settings.scope.label", "This board shows")}</Label>
      <Select
        value={board.scopeStrategy}
        disabled={scopeMutation.isPending}
        onValueChange={(value) => scopeMutation.mutate(value as BoardScopeStrategy)}
      >
        <SelectTrigger className="h-8 w-full sm:w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCOPE_STRATEGIES.map((strategy) => (
            <SelectItem key={strategy} value={strategy}>
              {resolveText(t, SCOPE_STRATEGY_COPY[strategy].option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Both consequences stay on screen, not only the chosen one: the option you are weighing up is
          the one you need explained, and neither is visible from inside a two-item select. */}
      <dl className="space-y-0.5 text-xs text-muted-foreground">
        {SCOPE_STRATEGIES.map((strategy) => (
          <div key={strategy} className={cn("flex gap-1.5", strategy === board.scopeStrategy && "text-foreground")}>
            <dt className="font-medium">{resolveText(t, SCOPE_STRATEGY_COPY[strategy].option)}</dt>
            <dd>{resolveText(t, SCOPE_STRATEGY_COPY[strategy].consequence)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** A blank box means "never drop completed issues"; anything else must be a whole, non-negative number
 *  of days. `undefined` marks input the box cannot send, so Save stays disabled rather than quietly
 *  posting `NaN` — which would serialise to `null` and read back as "never". */
function parseThreshold(days: string): number | null | undefined {
  if (days.trim().length === 0) {
    return null
  }

  const parsed = Number(days)

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

/** The done-threshold (ticket 06): how many days a completed issue stays on the board. Blank means it
 *  never drops off; `0` drops it as soon as it is done. The cutoff is measured against the issue's
 *  recorded completion time, so editing a done issue does not bring it back. */
function DoneThresholdRow({ projectId, board }: { projectId: string; board: BoardResponse }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [days, setDays] = useState(board.hideDoneOlderThanDays != null ? String(board.hideDoneOlderThanDays) : "")

  const threshold = parseThreshold(days)
  const invalid = threshold === undefined
  const unchanged = threshold === board.hideDoneOlderThanDays

  const thresholdMutation = useMutation({
    mutationFn: (value: number | null) => setDoneThreshold(projectId, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["board", projectId] })
      toast.success(t("board.settings.doneThreshold.saved", "Done-threshold updated"))
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, t("board.error.doneThreshold", "Could not update the done-threshold"))),
  })

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{t("board.settings.doneThreshold.label", "Hide completed issues older than")}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step={1}
          value={days}
          onChange={(event) => setDays(event.target.value)}
          placeholder={t("board.settings.doneThreshold.never", "Never")}
          aria-invalid={invalid}
          className="h-8 w-28"
        />
        <span className="text-sm text-muted-foreground">{t("board.settings.doneThreshold.days", "days")}</span>
        <Button
          size="sm"
          disabled={invalid || unchanged || thresholdMutation.isPending}
          onClick={() => threshold !== undefined && thresholdMutation.mutate(threshold)}
        >
          {t("common.save", "Save")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {invalid
          ? t("board.settings.doneThreshold.invalid", "Enter a whole number of days, or leave blank.")
          : t("board.settings.doneThreshold.hint", "Leave blank to keep completed issues on the board forever.")}
      </p>
    </div>
  )
}

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
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(column.name)
  const [minIssues, setMinIssues] = useState(column.minIssues != null ? String(column.minIssues) : "")
  const [maxIssues, setMaxIssues] = useState(column.maxIssues != null ? String(column.maxIssues) : "")

  const updateMutation = useMutation({
    mutationFn: () =>
      updateColumn(projectId, column.id, {
        name: name.trim(),
        minIssues: minIssues.trim() ? Number(minIssues) : null,
        maxIssues: maxIssues.trim() ? Number(maxIssues) : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["board", projectId] })
      setEditing(false)
      toast.success(t("board.settings.columnUpdated", "Column updated"))
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("board.error.updateColumn", "Could not update the column"))),
  })

  const statusById = new Map(statuses.map((status) => [status.id, status]))
  const availableStatuses = statuses.filter((status) => !mappedElsewhere.has(status.id))
  // One prompt, two slots — the trigger's placeholder and the disabled first item.
  const mapStatusPrompt = t("board.settings.mapStatus", "Map a status…")

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <button
              type="button"
              disabled={isFirst}
              onClick={onMoveUp}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label={t("board.settings.moveColumnUp", "Move column up")}
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={onMoveDown}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label={t("board.settings.moveColumnDown", "Move column down")}
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
          {editing ? (
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-8 w-40"
              maxLength={128}
              autoFocus
            />
          ) : (
            <span className="font-medium">{column.name}</span>
          )}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                disabled={name.trim().length === 0 || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
              >
                {t("common.save", "Save")}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                {t("common.edit", "Edit")}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                {t("common.delete", "Delete")}
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("board.settings.minIssues", "Min issues")}</Label>
            <Input
              type="number"
              min={0}
              value={minIssues}
              onChange={(event) => setMinIssues(event.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("board.settings.maxIssues", "Max issues")}</Label>
            <Input
              type="number"
              min={0}
              value={maxIssues}
              onChange={(event) => setMaxIssues(event.target.value)}
              className="h-8"
            />
          </div>
        </div>
      )}

      {!editing && (column.minIssues != null || column.maxIssues != null) && (
        <p className="text-xs text-muted-foreground">
          {t("board.settings.wipRange", "WIP: {minimum} – {maximum}", {
            minimum: column.minIssues ?? "—",
            maximum: column.maxIssues ?? "—",
          })}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Label className="w-24 shrink-0 text-xs text-muted-foreground">
          {t("board.settings.fallbackFor", "Fallback for")}
        </Label>
        <Select
          value={column.fallbackForCategory ?? NO_FALLBACK}
          onValueChange={(value) => onSetFallback(value === NO_FALLBACK ? null : (value as StatusCategory))}
        >
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_FALLBACK}>{t("board.settings.fallbackNone", "None")}</SelectItem>
            {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((category) => (
              <SelectItem key={category} value={category}>
                {resolveText(t, CATEGORY_LABEL[category])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Where the board ends and the backlog begins is exactly this choice (ADR-0016), so it says so
          at the moment it is being made rather than leaving the work to look lost. */}
      {column.fallbackForCategory === null && column.explicitStatusIds.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t(
            "board.settings.fallbackNoneHint",
            "This column holds nothing. Statuses no column maps appear in the backlog instead.",
          )}
        </p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("board.settings.explicitStatuses", "Explicit statuses")}</Label>
        <div className="flex flex-wrap gap-1">
          {column.explicitStatusIds.length === 0 && (
            <span className="text-xs text-muted-foreground">
              {t("board.settings.noExplicitStatuses", "None — falls back by category only.")}
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
          <Select value={CHOOSE_STATUS} onValueChange={onMapStatus}>
            <SelectTrigger className="h-8 w-56">
              <SelectValue placeholder={mapStatusPrompt} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CHOOSE_STATUS} disabled>
                {mapStatusPrompt}
              </SelectItem>
              {availableStatuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

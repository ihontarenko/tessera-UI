import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Columns3, ListTodo, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/EmptyState"
import { IssueDetailModal } from "@/components/issues/IssueDetailModal"
import { BoardGrid } from "@/components/board/BoardGrid"
import { BoardSettingsSheet } from "@/components/board/BoardSettingsSheet"
import { BoardToolbar } from "@/components/board/BoardToolbar"
import { SprintHeader } from "@/components/board/SprintHeader"
import {
  andTogether,
  applyMatchedCardIds,
  composeFilterExpression,
  toBoardFilters,
  withoutAgedOutCards,
} from "@/components/board/boardFilters"
import { groupIntoSwimlanes } from "@/components/board/swimlanes"
import { fetchBoardFilters } from "@/api/boardFilters"
import type { SavedFilterView } from "@/api/savedFilters"
import { useLanguage } from "@/context/LanguageContext"
import {
  getBoard,
  moveCard,
  setSwimlaneStrategy,
  type BoardCard,
  type BoardMoveRequest,
  type BoardResponse,
  type SwimlaneStrategy,
} from "@/api/boards"
import { fetchCatalog } from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"

const CHOOSE = "__choose__"
const RESOLUTION_REQUIRED = "resolution is required"

/** The Kanban board (Phase-2 tickets 01–06): cards laid out in their resolved columns, draggable within
 *  a column to reorder (rank only) or across columns to transition (through the Phase-1 workflow
 *  engine). A cross-column drop that lands on a Done-category status prompts for a resolution; a
 *  rejected move snaps back via the optimistic-cache rollback.
 *
 *  What the member sees is derived here in one direction: the flat payload is narrowed by the
 *  done-threshold and the active quick filters, then grouped into swimlanes. The server neither filters
 *  nor groups (ADR-0009) — it returns the slice and this component decides the view. */
export function BoardPanel({ projectId, permissions }: { projectId: string; permissions: string[] }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [, setSearchParameters] = useSearchParams()

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<BoardMoveRequest | null>(null)
  const [resolutionId, setResolutionId] = useState(CHOOSE)
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([])
  const [appliedFilter, setAppliedFilter] = useState<SavedFilterView | null>(null)

  const canEdit = permissions.includes("EDIT_ISSUE")
  const canTransition = permissions.includes("TRANSITION_ISSUE")
  const canAdminister = permissions.includes("ADMINISTER_PROJECT")
  const canDrag = canEdit || canTransition

  const { data: filterCatalog } = useQuery({ queryKey: ["board-filters"], queryFn: fetchBoardFilters })
  const boardFilters = useMemo(() => toBoardFilters(filterCatalog ?? []), [filterCatalog])

  const toggleExpression = useMemo(
    () => composeFilterExpression(boardFilters, activeFilterIds),
    [boardFilters, activeFilterIds],
  )

  // A saved filter and the toggles narrow together rather than replacing each other — "my issues" on top
  // of "Release blockers" is the obvious reading, and both sides are already bracketed predicates.
  const filterExpression = useMemo(
    () => andTogether([appliedFilter?.expression ?? null, toggleExpression]),
    [appliedFilter, toggleExpression],
  )

  // The expression is part of the cache key: the server evaluates the predicate, so two filter
  // selections are two different responses rather than one payload narrowed twice.
  const boardKey = ["board", projectId, filterExpression]

  const { data: board, isLoading } = useQuery({
    queryKey: boardKey,
    queryFn: () => getBoard(projectId, filterExpression),
  })
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })

  const moveMutation = useMutation({
    mutationFn: (request: BoardMoveRequest) => moveCard(projectId, request),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: boardKey })
      const previous = queryClient.getQueryData<BoardResponse>(boardKey)
      if (previous) {
        queryClient.setQueryData(boardKey, { ...previous, cards: reorderOptimistically(previous.cards, request) })
      }
      return { previous }
    },
    onError: (error, _request, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardKey, context.previous)
      }

      if (apiErrorMessage(error, "").toLowerCase().includes(RESOLUTION_REQUIRED)) {
        setResolutionId(CHOOSE)
        return
      }

      setPendingMove(null)
      toast.error(apiErrorMessage(error, t("board.error.move", "Could not move the card")))
    },
    onSuccess: (updatedCard) => {
      queryClient.setQueryData<BoardResponse>(boardKey, (current) =>
        current
          ? { ...current, cards: current.cards.map((card) => (card.id === updatedCard.id ? updatedCard : card)) }
          : current,
      )
      setPendingMove(null)
      setResolutionId(CHOOSE)
    },
  })

  const swimlaneMutation = useMutation({
    mutationFn: (strategy: SwimlaneStrategy) => setSwimlaneStrategy(projectId, strategy),
    onSuccess: (settings) => {
      queryClient.setQueryData<BoardResponse>(boardKey, (current) => (current ? { ...current, ...settings } : current))
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("board.error.grouping", "Could not change the grouping"))),
  })

  // What the board holds, once completed cards past the threshold have dropped off — the set WIP
  // counts are taken over, since a limit describes the stage and not one viewer's filtered view.
  const cardsOnBoard = useMemo(
    () => (board ? withoutAgedOutCards(board.cards, board.hideDoneOlderThanDays, Date.now()) : []),
    [board],
  )

  // What this viewer is looking at: the server evaluated the predicate and marked the survivors, so
  // all that is left here is hiding the rest — the only part that knows whose view it is.
  const swimlanes = useMemo(() => {
    if (!board) {
      return []
    }

    return groupIntoSwimlanes(applyMatchedCardIds(cardsOnBoard, board.matchedCardIds), board.swimlaneStrategy)
  }, [board, cardsOnBoard])

  function attemptMove(request: BoardMoveRequest) {
    setPendingMove(request)
    moveMutation.mutate(request)
  }

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) =>
      current.includes(filterId) ? current.filter((entry) => entry !== filterId) : [...current, filterId],
    )
  }

  function dismissResolutionPrompt() {
    setPendingMove(null)
    setResolutionId(CHOOSE)
    moveMutation.reset()
  }

  // One prompt, three slots — the field label, the trigger's placeholder and the disabled first item.
  const chooseResolution = t("board.resolution.choose", "Choose a resolution")

  const pendingColumn = board?.columns.find((column) => column.id === pendingMove?.targetColumnId)
  const resolutionPromptOpen =
    pendingMove !== null && apiErrorMessage(moveMutation.error, "").toLowerCase().includes(RESOLUTION_REQUIRED)

  if (isLoading) {
    return <Skeleton className="h-72 w-full" />
  }

  if (!board || board.columns.length === 0) {
    return (
      <EmptyState
        icon={Columns3}
        title={t("board.empty.title", "No board")}
        message={t("board.empty.message", "This project has no board columns yet.")}
      />
    )
  }

  // A sprint-scoped board with nothing running holds no cards by design — say so, and point at where a
  // sprint is started, rather than rendering an empty grid that reads as broken.
  if (board.scopeStrategy === "ACTIVE_SPRINT" && !board.activeSprint) {
    return (
      <EmptyState
        icon={ListTodo}
        title={t("board.noSprint.title", "No sprint is running")}
        message={t("board.noSprint.message", "Plan and start a sprint on the backlog and it appears here.")}
        action={
          <Button size="sm" variant="outline" onClick={() => setSearchParameters({ tab: "backlog" }, { replace: true })}>
            {t("board.noSprint.action", "Go to the backlog")}
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {board.activeSprint ? <SprintHeader sprint={board.activeSprint} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <BoardToolbar
          projectId={projectId}
          swimlaneStrategy={board.swimlaneStrategy}
          canChangeSwimlanes={canAdminister && !swimlaneMutation.isPending}
          onSwimlaneChange={(strategy) => swimlaneMutation.mutate(strategy)}
          filters={boardFilters}
          activeFilterIds={activeFilterIds}
          onToggleFilter={toggleFilter}
          appliedFilter={appliedFilter}
          toggleExpression={toggleExpression}
          onApplyFilter={setAppliedFilter}
        />

        {canAdminister && (
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-1.5 size-3.5" /> {t("board.settings.title", "Board settings")}
          </Button>
        )}
      </div>

      <BoardGrid
        columns={board.columns}
        swimlanes={swimlanes}
        cardsOnBoard={cardsOnBoard}
        canDrag={canDrag}
        onSelectCard={setSelectedIssueId}
        onMove={attemptMove}
      />

      <IssueDetailModal
        issueId={selectedIssueId}
        projectId={projectId}
        permissions={permissions}
        open={selectedIssueId !== null}
        onOpenChange={(next) => {
          if (!next) {
            setSelectedIssueId(null)
          }
        }}
      />

      <Dialog
        open={resolutionPromptOpen}
        onOpenChange={(next) => {
          if (!next) {
            dismissResolutionPrompt()
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("board.resolution.title", "Resolution for “{column}”", { column: pendingColumn?.name ?? "" })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{chooseResolution}</Label>
            <Select value={resolutionId} onValueChange={setResolutionId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={chooseResolution} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CHOOSE} disabled>
                  {chooseResolution}
                </SelectItem>
                {catalog?.resolutions.map((resolution) => (
                  <SelectItem key={resolution.id} value={resolution.id}>
                    {resolution.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={dismissResolutionPrompt}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={resolutionId === CHOOSE || moveMutation.isPending}
              onClick={() => pendingMove && attemptMove({ ...pendingMove, resolutionId })}
            >
              {t("common.confirm", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canAdminister && (
        <BoardSettingsSheet projectId={projectId} board={board} open={settingsOpen} onOpenChange={setSettingsOpen} />
      )}
    </div>
  )
}

/** Splice the dragged card into the client cache at the position implied by its move request — an
 *  optimistic mirror of the server's rank-between-neighbours so the card doesn't jump back to its old
 *  spot for the round trip. Reconciled with the server's actual response in {@code onSuccess}. */
function reorderOptimistically(cards: BoardCard[], request: BoardMoveRequest): BoardCard[] {
  const remaining = cards.filter((card) => card.issueKey !== request.issueKey)
  const dragged = cards.find((card) => card.issueKey === request.issueKey)
  if (!dragged) {
    return cards
  }

  const moved: BoardCard = { ...dragged, columnId: request.targetColumnId }

  let insertAt = remaining.length
  if (request.afterIssueKey) {
    const afterIndex = remaining.findIndex((card) => card.issueKey === request.afterIssueKey)
    if (afterIndex !== -1) {
      insertAt = afterIndex
    }
  } else if (request.beforeIssueKey) {
    const beforeIndex = remaining.findIndex((card) => card.issueKey === request.beforeIssueKey)
    if (beforeIndex !== -1) {
      insertAt = beforeIndex + 1
    }
  }

  remaining.splice(insertAt, 0, moved)
  return remaining
}

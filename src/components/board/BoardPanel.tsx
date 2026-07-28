import { Fragment, useMemo, useState } from "react"
import type { DragEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Columns3, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { IssueDetailModal } from "@/components/issues/IssueDetailModal"
import { IssueTypeIcon, PriorityBadge } from "@/components/issues/issueVisuals"
import { BoardSettingsSheet } from "@/components/board/BoardSettingsSheet"
import { getBoard, moveCard, type BoardCard, type BoardColumnView, type BoardMoveRequest } from "@/api/boards"
import { fetchCatalog } from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"
import { cn } from "@/lib/helpers"

const CHOOSE = "__choose__"
const RESOLUTION_REQUIRED = "resolution is required"

/** The Kanban board (Phase-2 tickets 01–03): cards laid out in their resolved columns, draggable within
 *  a column to reorder (rank only) or across columns to transition (through the Phase-1 workflow
 *  engine). A cross-column drop that lands on a Done-category status prompts for a resolution; a
 *  rejected move snaps back via the optimistic-cache rollback. Column headers flag WIP breaches
 *  visually — the limits themselves are never enforced. */
export function BoardPanel({ projectId, permissions }: { projectId: string; permissions: string[] }) {
  const queryClient = useQueryClient()
  const boardKey = ["board", projectId]

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<BoardMoveRequest | null>(null)
  const [resolutionId, setResolutionId] = useState(CHOOSE)

  const canEdit = permissions.includes("EDIT_ISSUE")
  const canTransition = permissions.includes("TRANSITION_ISSUE")
  const canAdminister = permissions.includes("ADMINISTER_PROJECT")
  const canDrag = canEdit || canTransition

  const { data: board, isLoading } = useQuery({ queryKey: boardKey, queryFn: () => getBoard(projectId) })
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })

  const moveMutation = useMutation({
    mutationFn: (request: BoardMoveRequest) => moveCard(projectId, request),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: boardKey })
      const previous = queryClient.getQueryData<Awaited<ReturnType<typeof getBoard>>>(boardKey)
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
      toast.error(apiErrorMessage(error, "Could not move the card"))
    },
    onSuccess: (updatedCard) => {
      queryClient.setQueryData<Awaited<ReturnType<typeof getBoard>>>(boardKey, (current) =>
        current ? { ...current, cards: current.cards.map((card) => (card.id === updatedCard.id ? updatedCard : card)) } : current,
      )
      setPendingMove(null)
      setResolutionId(CHOOSE)
    },
  })

  const cardsByColumn = useMemo(() => {
    const grouped = new Map<string, BoardCard[]>()
    for (const card of board?.cards ?? []) {
      if (card.columnId === null) {
        continue
      }
      const bucket = grouped.get(card.columnId) ?? []
      bucket.push(card)
      grouped.set(card.columnId, bucket)
    }
    return grouped
  }, [board])

  function attemptMove(request: BoardMoveRequest) {
    setPendingMove(request)
    moveMutation.mutate(request)
  }

  const pendingColumn = board?.columns.find((column) => column.id === pendingMove?.targetColumnId)
  const resolutionPromptOpen = pendingMove !== null && apiErrorMessage(moveMutation.error, "").toLowerCase().includes(RESOLUTION_REQUIRED)

  if (isLoading) {
    return <Skeleton className="h-72 w-full" />
  }

  if (!board || board.columns.length === 0) {
    return (
      <EmptyState
        icon={Columns3}
        title="No board"
        message="This project has no board columns yet."
      />
    )
  }

  return (
    <div className="space-y-3">
      {canAdminister && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-1.5 size-3.5" /> Board settings
          </Button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {board.columns.map((column) => (
          <BoardColumnLane
            key={column.id}
            column={column}
            cards={cardsByColumn.get(column.id) ?? []}
            canDrag={canDrag}
            onSelectCard={setSelectedIssueId}
            onMove={attemptMove}
          />
        ))}
      </div>

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
            setPendingMove(null)
            setResolutionId(CHOOSE)
            moveMutation.reset()
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Resolution for “{pendingColumn?.name}”</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Choose a resolution</Label>
            <Select value={resolutionId} onValueChange={setResolutionId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a resolution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CHOOSE} disabled>
                  Choose a resolution
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
            <Button
              variant="ghost"
              onClick={() => {
                setPendingMove(null)
                setResolutionId(CHOOSE)
                moveMutation.reset()
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={resolutionId === CHOOSE || moveMutation.isPending}
              onClick={() => pendingMove && attemptMove({ ...pendingMove, resolutionId })}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canAdminister && (
        <BoardSettingsSheet
          projectId={projectId}
          board={board}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
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

function BoardColumnLane({
  column,
  cards,
  canDrag,
  onSelectCard,
  onMove,
}: {
  column: BoardColumnView
  cards: BoardCard[]
  canDrag: boolean
  onSelectCard: (issueId: string) => void
  onMove: (request: BoardMoveRequest) => void
}) {
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const overMax = column.maxIssues != null && cards.length > column.maxIssues
  const underMin = column.minIssues != null && cards.length < column.minIssues

  function computeDropIndex(event: DragEvent<HTMLElement>, index: number) {
    const rect = event.currentTarget.getBoundingClientRect()
    const isAbove = event.clientY < rect.top + rect.height / 2
    return isAbove ? index : index + 1
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const issueKey = event.dataTransfer.getData("text/plain")
    const index = dropIndex ?? cards.length
    setDropIndex(null)

    if (!issueKey) {
      return
    }

    const withoutDragged = cards.filter((card) => card.issueKey !== issueKey)
    const clampedIndex = Math.min(index, withoutDragged.length)
    const beforeCard = clampedIndex > 0 ? withoutDragged[clampedIndex - 1] : undefined
    const afterCard = clampedIndex < withoutDragged.length ? withoutDragged[clampedIndex] : undefined

    onMove({
      issueKey,
      targetColumnId: column.id,
      beforeIssueKey: beforeCard?.issueKey ?? null,
      afterIssueKey: afterCard?.issueKey ?? null,
    })
  }

  return (
    <section
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30",
        overMax && "border-destructive/60",
        underMin && "border-amber-500/60",
      )}
      onDragOver={(event) => {
        if (!canDrag) {
          return
        }
        event.preventDefault()
        if (dropIndex === null) {
          setDropIndex(cards.length)
        }
      }}
      onDragLeave={() => setDropIndex(null)}
      onDrop={canDrag ? handleDrop : undefined}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="truncate text-sm font-medium">{column.name}</span>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-xs tabular-nums",
            overMax ? "bg-destructive/15 text-destructive" : underMin ? "bg-amber-500/15 text-amber-600" : "bg-background text-muted-foreground",
          )}
          title={
            overMax
              ? `Over the limit of ${column.maxIssues}`
              : underMin
                ? `Under the minimum of ${column.minIssues}`
                : undefined
          }
        >
          {cards.length}
          {column.maxIssues != null ? ` / ${column.maxIssues}` : ""}
        </span>
      </header>

      <div className="flex flex-col gap-2 p-2">
        {cards.length === 0 && dropIndex === null ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">No issues</p>
        ) : (
          cards.map((card, index) => (
            <Fragment key={card.id}>
              {dropIndex === index && <DropPlaceholder />}
              <IssueCard
                card={card}
                draggable={canDrag}
                onSelect={onSelectCard}
                onDragStart={(event) => event.dataTransfer.setData("text/plain", card.issueKey)}
                onDragOver={(event) => {
                  if (!canDrag) {
                    return
                  }
                  event.preventDefault()
                  event.stopPropagation()
                  setDropIndex(computeDropIndex(event, index))
                }}
              />
            </Fragment>
          ))
        )}
        {dropIndex === cards.length && cards.length > 0 && <DropPlaceholder />}
      </div>
    </section>
  )
}

function DropPlaceholder() {
  return <div className="h-14 shrink-0 rounded-md border-2 border-dashed border-primary/50 bg-primary/5" />
}

function IssueCard({
  card,
  draggable,
  onSelect,
  onDragStart,
  onDragOver,
}: {
  card: BoardCard
  draggable: boolean
  onSelect: (issueId: string) => void
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onClick={() => onSelect(card.id)}
      className={cn(
        "flex w-full flex-col gap-2 rounded-md border bg-background p-2.5 text-left shadow-sm transition-colors hover:border-primary/40",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <span className={cn("text-sm", card.open ? "" : "text-muted-foreground line-through")}>{card.summary}</span>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <IssueTypeIcon type={card.type} />
          <span className="font-mono text-xs text-muted-foreground">{card.issueKey}</span>
        </span>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={card.priority} />
          {card.assignee ? (
            <MemberChip member={card.assignee} className="[&_.text-sm]:hidden" />
          ) : null}
        </div>
      </div>
    </button>
  )
}

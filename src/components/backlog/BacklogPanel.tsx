import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ListTodo, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/EmptyState"
import { CreateIssueDialog } from "@/components/issues/CreateIssueDialog"
import { IssueDetailModal } from "@/components/issues/IssueDetailModal"
import { BacklogSectionCard } from "@/components/backlog/BacklogSectionCard"
import { SprintFormDialog } from "@/components/backlog/SprintFormDialog"
import { StartSprintDialog } from "@/components/backlog/StartSprintDialog"
import { applyMove, toSections } from "@/components/backlog/backlogSections"
import { plansInSprints } from "@/lib/projectStyle"
import { useLanguage } from "@/context/LanguageContext"
import {
  createSprint,
  deleteSprint,
  getBacklog,
  listSprints,
  moveBacklogIssue,
  startSprint,
  updateSprint,
  MANAGE_SPRINT,
  type BacklogMoveRequest,
  type BacklogResponse,
  type SaveSprintRequest,
  type SprintSummary,
} from "@/api/sprints"
import { getIssue, updateIssue } from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"

interface SprintFormState {
  mode: "create" | "rename"
  sprint: SprintSummary | null
}

/**
 * The backlog screen (Phase-3 tickets 02/03): the running sprint, then each planned sprint, then the
 * product backlog. Work is dragged between every one of them through a single endpoint that changes
 * membership and rank together, applied optimistically here and rolled back if the server refuses —
 * the pattern the board already uses.
 *
 * Every project has this screen (ADR-0016), so nothing here turns it away. What the scope strategy
 * still decides is the *commitment* half: a project not running sprints gets no sprint panels from the
 * server and no controls for planning or starting one, leaving the product backlog on its own — the
 * open work its board does not render.
 *
 * Permissions split the way the server's do: changing which list an issue is in needs
 * {@code MANAGE_SPRINT}, reordering within one needs {@code EDIT_ISSUE}. The client offers dragging
 * when either is held and lets the server have the final word, so a refusal surfaces as a readable
 * message rather than a disabled control the member cannot explain.
 */
export function BacklogPanel({ projectId, permissions }: { projectId: string; permissions: string[] }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const backlogKey = ["backlog", projectId]

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [sprintForm, setSprintForm] = useState<SprintFormState | null>(null)
  const [sprintToStart, setSprintToStart] = useState<SprintSummary | null>(null)

  const canManageSprint = permissions.includes(MANAGE_SPRINT)
  const canEditIssue = permissions.includes("EDIT_ISSUE")
  const canCreateIssue = permissions.includes("CREATE_ISSUE")
  const canDrag = canManageSprint || canEditIssue

  const { data: backlog, isLoading } = useQuery({ queryKey: backlogKey, queryFn: () => getBacklog(projectId) })
  // Sprints are the one thing the scope strategy still gates (ADR-0016), so a project without them
  // never asks for the list its controls would have been built from.
  const runsSprints = backlog ? plansInSprints(backlog.scopeStrategy) : false
  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => listSprints(projectId),
    enabled: runsSprints,
  })

  /** A membership change reshapes the board too, and a rank change reorders the issue list. */
  function refreshDependentViews() {
    void queryClient.invalidateQueries({ queryKey: ["board", projectId] })
    void queryClient.invalidateQueries({ queryKey: ["issues", projectId] })
  }

  function refreshSprints() {
    void queryClient.invalidateQueries({ queryKey: backlogKey })
    void queryClient.invalidateQueries({ queryKey: ["sprints", projectId] })
    void queryClient.invalidateQueries({ queryKey: ["board", projectId] })
  }

  const moveMutation = useMutation({
    mutationFn: (request: BacklogMoveRequest) => moveBacklogIssue(projectId, request),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: backlogKey })
      const previous = queryClient.getQueryData<BacklogResponse>(backlogKey)

      if (previous) {
        queryClient.setQueryData(backlogKey, applyMove(previous, request))
      }

      return { previous }
    },
    onError: (error, _request, context) => {
      if (context?.previous) {
        queryClient.setQueryData(backlogKey, context.previous)
      }
      toast.error(apiErrorMessage(error, t("backlog.error.move", "Could not move the issue")))
    },
    onSuccess: (screen) => {
      queryClient.setQueryData(backlogKey, screen)
      refreshDependentViews()
    },
  })

  const storyPointsMutation = useMutation({
    // The issue-update path replaces the whole editable field set, so the estimate is written back on
    // top of the issue as it currently stands — sending the row's fields alone would blank the description.
    mutationFn: async ({ issueId, storyPoints }: { issueId: string; storyPoints: number | null }) => {
      const issue = await getIssue(issueId)

      return updateIssue(issueId, {
        summary: issue.summary,
        description: issue.description,
        priorityId: issue.priority?.id ?? "",
        assigneeMemberId: issue.assignee?.id ?? null,
        storyPoints,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: backlogKey })
      refreshDependentViews()
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("backlog.error.estimate", "Could not save the estimate"))),
  })

  const saveSprintMutation = useMutation({
    mutationFn: (request: SaveSprintRequest) =>
      sprintForm?.sprint
        ? updateSprint(projectId, sprintForm.sprint.id, request)
        : createSprint(projectId, request),
    onSuccess: (sprint) => {
      refreshSprints()
      setSprintForm(null)
      toast.success(t("sprint.saved", "Sprint {sprint} saved", { sprint: sprint.name }))
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("sprint.error.save", "Could not save the sprint"))),
  })

  const deleteSprintMutation = useMutation({
    mutationFn: (sprintId: string) => deleteSprint(projectId, sprintId),
    onSuccess: () => {
      refreshSprints()
      toast.success(t("sprint.deleted", "Sprint deleted — its issues returned to the backlog"))
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("sprint.error.delete", "Could not delete the sprint"))),
  })

  const startSprintMutation = useMutation({
    mutationFn: ({ sprintId, endDate }: { sprintId: string; endDate: string }) =>
      startSprint(projectId, sprintId, endDate),
    onSuccess: (sprint) => {
      refreshSprints()
      setSprintToStart(null)
      toast.success(t("sprint.started", "{sprint} is running", { sprint: sprint.name }))
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("sprint.error.start", "Could not start the sprint"))),
  })

  const sections = useMemo(() => (backlog ? toSections(backlog) : []), [backlog])
  const panelToStart = backlog?.futureSprints.find((panel) => panel.sprint?.id === sprintToStart?.id)

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  if (!backlog) {
    return (
      <EmptyState
        icon={ListTodo}
        title={t("backlog.empty.title", "No backlog")}
        message={t("backlog.empty.message", "This project has no backlog yet.")}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {runsSprints && canManageSprint && (
          <Button size="sm" variant="outline" onClick={() => setSprintForm({ mode: "create", sprint: null })}>
            <Plus className="mr-1.5 size-3.5" /> {t("sprint.create.action", "Plan a sprint")}
          </Button>
        )}
        {canCreateIssue && <CreateIssueDialog projectId={projectId} />}
      </div>

      {sections.map((section) => {
        const sprint = section.panel.sprint

        return (
          <BacklogSectionCard
            key={section.id}
            section={section}
            canDrag={canDrag}
            canEditStoryPoints={canEditIssue}
            onSelectIssue={setSelectedIssueId}
            onMove={(request) => moveMutation.mutate(request)}
            onChangeStoryPoints={(issueId, storyPoints) => storyPointsMutation.mutate({ issueId, storyPoints })}
            actions={
              canManageSprint && sprint ? (
                <SprintActions
                  sprint={sprint}
                  canStart={section.kind === "futureSprint"}
                  onStart={() => setSprintToStart(sprint)}
                  onRename={() => setSprintForm({ mode: "rename", sprint })}
                  onDelete={() => deleteSprintMutation.mutate(sprint.id)}
                />
              ) : undefined
            }
          />
        )
      })}

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

      <SprintFormDialog
        open={sprintForm !== null}
        onOpenChange={(next) => {
          if (!next) {
            setSprintForm(null)
          }
        }}
        mode={sprintForm?.mode ?? "create"}
        suggestedName={t("sprint.create.suggestedName", "Sprint {number}", { number: sprints.length + 1 })}
        initialName={sprintForm?.sprint?.name}
        initialGoal={sprintForm?.sprint?.goal}
        isPending={saveSprintMutation.isPending}
        onSubmit={(request) => saveSprintMutation.mutate(request)}
      />

      <StartSprintDialog
        sprint={sprintToStart}
        open={sprintToStart !== null}
        onOpenChange={(next) => {
          if (!next) {
            setSprintToStart(null)
          }
        }}
        committedIssues={panelToStart?.issueCount ?? 0}
        committedPoints={panelToStart?.storyPointTotal ?? 0}
        isPending={startSprintMutation.isPending}
        onStart={(endDate) => sprintToStart && startSprintMutation.mutate({ sprintId: sprintToStart.id, endDate })}
      />
    </div>
  )
}

/** A sprint panel's header controls. Deleting is offered for any sprint the member manages; the server
 *  refuses anything but a future one with a readable 409 rather than the client guessing the rule. */
function SprintActions({
  sprint,
  canStart,
  onStart,
  onRename,
  onDelete,
}: {
  sprint: SprintSummary
  canStart: boolean
  onStart: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const { t } = useLanguage()

  return (
    <>
      {canStart && (
        <Button size="sm" variant="outline" onClick={onStart}>
          <Play className="mr-1.5 size-3.5" /> {t("sprint.start.action", "Start sprint")}
        </Button>
      )}
      <Button size="icon" variant="ghost" className="size-7" title={t("sprint.rename.action", "Edit sprint")} onClick={onRename}>
        <Pencil className="size-3.5" />
      </Button>
      {sprint.state === "FUTURE" && (
        <Button size="icon" variant="ghost" className="size-7" title={t("sprint.delete.action", "Delete sprint")} onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </>
  )
}

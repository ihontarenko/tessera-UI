import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronDown, CircleDot } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@jmouse/ui"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { IssueListRow, IssueRowLayout } from "@/components/issues/rows/IssueListRow"
import { EpicsPanel } from "@/components/issues/epics/EpicsPanel"
import { useLanguage } from "@/context/LanguageContext"
import { CreateIssueDialog } from "@/components/issues/CreateIssueDialog"
import { IssueDetailModal } from "@/components/issues/IssueDetailModal"
import { PriorityBadge, StatusPill, formatStoryPoints } from "@/components/issues/issueVisuals"
import { IssueSortControl } from "@/components/issues/sorting/IssueSortControl"
import {
  PROJECT_DEFAULT_SORT,
  PROJECT_SORTS,
  findSort,
  sortIssues,
  type SortDirection,
} from "@/components/issues/sorting/issueSorting"
import { fetchCatalog, getIssue, listIssues, transitionIssue, type IssueRow } from "@/api/issues"
import { CREATE_ISSUE, TRANSITION_ISSUE } from "@/api/permissions"
import { apiErrorMessage } from "@/api/errors"

const ANY = "__any__"

/**
 * What the schedule filter can be narrowed to — the same four the protocol's `issues_list` offers, by
 * the same names, so an answer read in a conversation and a list read on screen mean one thing.
 */
type QueueFilter = typeof ANY | "due" | "overdue" | "upcoming" | "unscheduled"

const QUEUE_OPTIONS: Array<{ id: QueueFilter; label: string }> = [
  { id: "due", label: "Up next" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Scheduled later" },
  { id: "unscheduled", label: "No date" },
]

/**
 * Whether a row survives the schedule filter.
 *
 * ⚠️ **Reads `state`, never the dates.** The precedence between the three is the server's, decided once
 * — re-deriving it here would be a filter that disagreed with the badge on the row it kept.
 */
function matchesQueue(issue: IssueRow, queue: QueueFilter): boolean {
  switch (queue) {
    case "due":
      return ["QUEUED", "RED_LINE", "DUE_TODAY", "OVERDUE"].includes(issue.schedule.state)
    case "overdue":
      return issue.schedule.state === "OVERDUE"
    case "upcoming":
      return issue.schedule.state === "SCHEDULED"
    case "unscheduled":
      return issue.schedule.state === "NONE"
    default:
      return true
  }
}

/**
 * The project's issues, in two views.
 *
 * **List** is the dense ranked table (ticket 07/54/55), filtered client-side by the common fields.
 * **Epics** is the same work gathered under the epic each issue belongs to — the hierarchy counterpart of the
 * Registers tab's link-based grouping, and the answer to "how much of this epic is done" that the flat table
 * cannot give however it is sorted.
 *
 * The create control belongs to the panel rather than to either view: one project, one create button.
 *
 * ⚠️ **The two views open a row differently, and that is deliberate rather than an oversight.** A List row
 * opens the quick-view modal, which needs one project's permissions and has them here. An Epics row is a
 * link to `/issues/{key}`, the same choice the cross-project search made: a grouped view is read as a
 * register, and following an item out of it should land somewhere addressable that resolves its own
 * permissions.
 */
export function IssuesPanel({ projectId, permissions }: { projectId: string; permissions: string[] }) {
  const { t } = useLanguage()
  const [statusId, setStatusId] = useState(ANY)
  const [issueTypeId, setIssueTypeId] = useState(ANY)
  const [priorityId, setPriorityId] = useState(ANY)
  const [assigneeMemberId, setAssigneeMemberId] = useState(ANY)
  const [queue, setQueue] = useState<QueueFilter>(ANY)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)

  // ⚠️ Ordered in the browser, not asked of the server. This list arrives whole — it is already filtered
  // here — so a sort is a reordering of what is on screen rather than a round trip. The cross-project
  // search cannot do the same, because it is paged in the database; see `issueSorting.ts`.
  const [sortId, setSortId] = useState(PROJECT_DEFAULT_SORT)
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    findSort(PROJECT_DEFAULT_SORT, PROJECT_SORTS).defaultDirection,
  )

  // ⚠️ In the URL, like every other view choice in this application — a register somebody is reading is a
  // thing they send to somebody else. And it MERGES rather than replaces: the project page owns `?tab=`, so
  // writing a bare `{ view }` would drop the tab and bounce the reader back to Board.
  const [searchParameters, setSearchParameters] = useSearchParams()
  const view = searchParameters.get("view") === "epics" ? "epics" : "list"

  function openView(next: string) {
    const merged = new URLSearchParams(searchParameters)

    merged.set("view", next)
    setSearchParameters(merged, { replace: true })
  }

  const { data: issues, isLoading } = useQuery({ queryKey: ["issues", projectId], queryFn: () => listIssues(projectId) })
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })

  const canCreate = permissions.includes(CREATE_ISSUE)
  const canTransition = permissions.includes(TRANSITION_ISSUE)

  const assignees = useMemo(() => {
    const seen = new Map<string, { id: string; displayName: string | null; email: string | null }>()
    for (const issue of issues ?? []) {
      if (issue.assignee) {
        seen.set(issue.assignee.id, issue.assignee)
      }
    }
    return [...seen.values()]
  }, [issues])

  const matching = (issues ?? []).filter((issue) => {
    if (statusId !== ANY && issue.status?.id !== statusId) {
      return false
    }
    if (issueTypeId !== ANY && issue.type?.id !== issueTypeId) {
      return false
    }
    if (priorityId !== ANY && issue.priority?.id !== priorityId) {
      return false
    }
    if (assigneeMemberId !== ANY && issue.assignee?.id !== assigneeMemberId) {
      return false
    }
    if (!matchesQueue(issue, queue)) {
      return false
    }
    return true
  })

  // ⚠️ Not memoised, deliberately. The filter above is not either, and a project's list is hundreds of
  // rows — a comparison sort over it is well under a frame. Memoising would mean a dependency array
  // listing four filters and two sort values beside a `matching` that is rebuilt every render anyway,
  // which is a longer way to be wrong.
  const filtered = sortIssues(matching, sortId, sortDirection, PROJECT_SORTS)

  return (
    <Tabs value={view} onValueChange={openView} className="space-y-3">
      {/* The create control sits on the tab strip rather than in the filter row: it belongs to the project,
          not to either view of it, and duplicating it into both would be two buttons doing one thing. */}
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="list">{t("issues.view.list", "List")}</TabsTrigger>
          <TabsTrigger value="epics">{t("issues.view.epics", "Epics")}</TabsTrigger>
        </TabsList>
        {canCreate && (
          <div className="ml-auto">
            <CreateIssueDialog projectId={projectId} />
          </div>
        )}
      </div>

      <TabsContent value="epics">
        <EpicsPanel projectId={projectId} />
      </TabsContent>

      <TabsContent value="list" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={statusId} onChange={setStatusId} placeholder="Status" options={(catalog?.statuses ?? []).map((status) => ({ id: status.id, label: status.name }))} />
        <FilterSelect value={issueTypeId} onChange={setIssueTypeId} placeholder="Type" options={(catalog?.issueTypes ?? []).map((type) => ({ id: type.id, label: type.name }))} />
        <FilterSelect value={priorityId} onChange={setPriorityId} placeholder="Priority" options={(catalog?.priorities ?? []).map((priority) => ({ id: priority.id, label: priority.name }))} />
        <FilterSelect
          value={assigneeMemberId}
          onChange={setAssigneeMemberId}
          placeholder="Assignee"
          options={assignees.map((assignee) => ({ id: assignee.id, label: assignee.displayName || assignee.email || assignee.id }))}
        />
        <FilterSelect
          value={queue}
          onChange={(value) => setQueue(value as QueueFilter)}
          placeholder="Schedule"
          options={QUEUE_OPTIONS}
        />

        {/* Pushed to the far end: everything to its left narrows the list, this one only reorders it. */}
        <IssueSortControl
          className="ml-auto"
          options={PROJECT_SORTS}
          sortId={sortId}
          direction={sortDirection}
          onChange={(nextSort, nextDirection) => {
            setSortId(nextSort)
            setSortDirection(nextDirection)
          }}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CircleDot}
          title="No issues"
          message={issues && issues.length > 0 ? "No issues match the current filters." : "Create the first issue in this project."}
        />
      ) : (
        // One row shape, shared with every other list (TSSR-53). No project column: everything here is this
        // project's. The status stays a *control* rather than a pill, which is what `statusSlot` is for.
        <IssueRowLayout withProject={false}>
          {filtered.map((issue) => (
            <IssueListRow
              key={issue.id}
              issueKey={issue.issueKey}
              summary={issue.summary}
              type={issue.type}
              status={issue.status}
              open={issue.open}
              schedule={issue.schedule}
              onOpen={() => setSelectedIssueId(issue.id)}
              trailing={
                <>
                  <PriorityBadge priority={issue.priority} />
                  {issue.assignee ? (
                    <MemberChip member={issue.assignee} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                  <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                    {formatStoryPoints(issue.storyPoints)}
                  </span>
                </>
              }
              statusSlot={
                canTransition ? (
                  <RowStatusControl issue={issue} projectId={projectId} onNeedsResolution={setSelectedIssueId} />
                ) : undefined
              }
            />
          ))}
        </IssueRowLayout>
      )}
      </TabsContent>

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
    </Tabs>
  )
}

/** Inline table transition control (ticket 09, "transition control in detail + table"). Lazily loads
 *  the issue's legal transitions when opened; a Done-requiring transition defers to the detail modal
 *  (via onNeedsResolution) so the resolution can be chosen there. */
function RowStatusControl({
  issue,
  projectId,
  onNeedsResolution,
}: {
  issue: IssueRow
  projectId: string
  onNeedsResolution: (issueId: string) => void
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: detail } = useQuery({
    queryKey: ["issue", issue.id],
    queryFn: () => getIssue(issue.id),
    enabled: open,
  })

  const transitionMutation = useMutation({
    mutationFn: (toStatusId: string) => transitionIssue(issue.id, toStatusId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["issue", issue.id], updated)
      void queryClient.invalidateQueries({ queryKey: ["issues", projectId] })
      toast.success("Issue transitioned")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not transition the issue")),
  })

  const transitions = detail?.availableTransitions ?? []

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1">
          <StatusPill status={issue.status} />
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {transitions.length === 0 ? (
          <DropdownMenuItem disabled>No transitions</DropdownMenuItem>
        ) : (
          transitions.map((option) => (
            <DropdownMenuItem
              key={option.transitionId}
              onSelect={() => {
                if (option.requiresResolution) {
                  onNeedsResolution(issue.id)
                } else {
                  transitionMutation.mutate(option.toStatusId)
                }
              }}
            >
              {option.name} → {option.toStatusName}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: Array<{ id: string; label: string }>
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{placeholder}: any</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

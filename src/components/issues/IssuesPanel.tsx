import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronDown, CircleDot } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { EpicsPanel } from "@/components/issues/epics/EpicsPanel"
import { CreateIssueDialog } from "@/components/issues/CreateIssueDialog"
import { IssueDetailModal } from "@/components/issues/IssueDetailModal"
import { IssueTypeIcon, PriorityBadge, StatusPill, formatStoryPoints } from "@/components/issues/issueVisuals"
import { fetchCatalog, getIssue, listIssues, transitionIssue, type IssueRow } from "@/api/issues"
import { CREATE_ISSUE, TRANSITION_ISSUE } from "@/api/permissions"
import { apiErrorMessage } from "@/api/errors"

const ANY = "__any__"

/**
 * The project's issues, in two views.
 *
 * **List** is the dense ranked table (ticket 07/54/55), filtered client-side by the common fields.
 * **Epics** is the same work gathered under the epic each issue belongs to — the hierarchy counterpart of the
 * Tracked tab's link-based grouping, and the answer to "how much of this epic is done" that the flat table
 * cannot give however it is sorted.
 *
 * The create control and the detail modal belong to the panel rather than to either view: one project, one
 * create button, and a row opens the same modal from wherever it was clicked.
 */
export function IssuesPanel({ projectId, permissions }: { projectId: string; permissions: string[] }) {
  const [statusId, setStatusId] = useState(ANY)
  const [issueTypeId, setIssueTypeId] = useState(ANY)
  const [priorityId, setPriorityId] = useState(ANY)
  const [assigneeMemberId, setAssigneeMemberId] = useState(ANY)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [view, setView] = useState("list")

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

  const filtered = (issues ?? []).filter((issue) => {
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
    return true
  })

  return (
    <Tabs value={view} onValueChange={setView} className="space-y-3">
      {/* The create control sits on the tab strip rather than in the filter row: it belongs to the project,
          not to either view of it, and duplicating it into both would be two buttons doing one thing. */}
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="epics">Epics</TabsTrigger>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-24">Key</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="w-28">Priority</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-44">Assignee</TableHead>
              <TableHead className="w-16 text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((issue) => (
              <TableRow
                key={issue.id}
                className="cursor-pointer"
                onClick={() => setSelectedIssueId(issue.id)}
              >
                <TableCell>
                  <IssueTypeIcon type={issue.type} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{issue.issueKey}</TableCell>
                <TableCell>
                  <span className={issue.open ? "" : "text-muted-foreground line-through"}>{issue.summary}</span>
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={issue.priority} />
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  {canTransition ? (
                    <RowStatusControl issue={issue} projectId={projectId} onNeedsResolution={setSelectedIssueId} />
                  ) : (
                    <StatusPill status={issue.status} />
                  )}
                </TableCell>
                <TableCell>
                  {issue.assignee ? (
                    <MemberChip member={issue.assignee} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{formatStoryPoints(issue.storyPoints)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

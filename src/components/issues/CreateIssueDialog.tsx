import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createIssue, fetchCatalog, listIssues } from "@/api/issues"
import { listProjectIssueTypes } from "@/api/projects"
import { searchMembers } from "@/api/members"
import { apiErrorMessage } from "@/api/errors"
import { memberName } from "@/lib/memberDisplay"

const UNASSIGNED = "__unassigned__"
const NO_PARENT = "__none__"

/** Create an issue in a project. The type list is project-scoped — only what the project's issue type
 *  scheme grants, preselected on that scheme's default — while priority still comes from the global
 *  catalog, which genuinely is global. The key, initial status and reporter are assigned server-side. */
export function CreateIssueDialog({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState("")
  const [description, setDescription] = useState("")
  const [issueTypeId, setIssueTypeId] = useState("")
  const [priorityId, setPriorityId] = useState("")
  const [assigneeMemberId, setAssigneeMemberId] = useState(UNASSIGNED)
  const [parentId, setParentId] = useState(NO_PARENT)
  const [storyPoints, setStoryPoints] = useState("")

  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog, enabled: open })
  const { data: projectIssueTypes } = useQuery({
    queryKey: ["project-issue-types", projectId],
    queryFn: () => listProjectIssueTypes(projectId),
    enabled: open,
  })
  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers(), enabled: open })
  const { data: issues = [] } = useQuery({
    queryKey: ["issues", projectId],
    queryFn: () => listIssues(projectId),
    enabled: open,
  })

  // `defaultIssueTypeId` is guaranteed to be one of `issueTypes`, so it needs no re-checking here —
  // the backend resolves the scheme's default against what the scheme actually grants.
  const offeredTypes = projectIssueTypes?.issueTypes ?? []
  const resolvedType = issueTypeId || projectIssueTypes?.defaultIssueTypeId || ""
  const resolvedPriority = priorityId || catalog?.priorities.find((entry) => entry.name === "Medium")?.id || catalog?.priorities[0]?.id || ""
  const canSubmit = summary.trim().length > 0 && resolvedType.length > 0 && resolvedPriority.length > 0

  const mutation = useMutation({
    mutationFn: () =>
      createIssue(projectId, {
        summary: summary.trim(),
        description: description.trim() || null,
        issueTypeId: resolvedType,
        priorityId: resolvedPriority,
        assigneeMemberId: assigneeMemberId === UNASSIGNED ? null : assigneeMemberId,
        parentId: parentId === NO_PARENT ? null : parentId,
        storyPoints: storyPoints.trim() ? Number(storyPoints) : null,
      }),
    onSuccess: (issue) => {
      void queryClient.invalidateQueries({ queryKey: ["issues", projectId] })
      // A new open issue lands in the backlog uncommitted, so the planning screen is stale too.
      void queryClient.invalidateQueries({ queryKey: ["backlog", projectId] })
      toast.success(`Issue ${issue.issueKey} created`)
      resetAndClose()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not create the issue")),
  })

  function resetAndClose() {
    setOpen(false)
    setSummary("")
    setDescription("")
    setIssueTypeId("")
    setPriorityId("")
    setAssigneeMemberId(UNASSIGNED)
    setParentId(NO_PARENT)
    setStoryPoints("")
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button size="sm">New issue</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create an issue</DialogTitle>
          <DialogDescription>It gets a key like TIC-1 and starts in the workflow's first status.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) {
              mutation.mutate()
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={resolvedType} onValueChange={setIssueTypeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {offeredTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={resolvedPriority} onValueChange={setPriorityId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catalog?.priorities.map((priority) => (
                    <SelectItem key={priority.id} value={priority.id}>
                      {priority.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issue-summary">Summary</Label>
            <Input
              id="issue-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Short, action-oriented title"
              maxLength={255}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issue-description">Description</Label>
            <Textarea
              id="issue-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional detail…"
              rows={4}
              maxLength={4000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={assigneeMemberId} onValueChange={setAssigneeMemberId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {memberName(member)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-points">Story points</Label>
              <Input
                id="issue-points"
                type="number"
                min={0}
                step="0.5"
                value={storyPoints}
                onChange={(event) => setStoryPoints(event.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Parent</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>None</SelectItem>
                {issues.map((issue) => (
                  <SelectItem key={issue.id} value={issue.id}>
                    {issue.issueKey} · {issue.summary}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">The parent's type must be higher in the hierarchy.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

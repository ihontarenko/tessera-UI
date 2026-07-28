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
import { searchMembers } from "@/api/members"
import { apiErrorMessage } from "@/api/errors"
import { memberName } from "@/lib/memberDisplay"

const UNASSIGNED = "__unassigned__"
const NO_PARENT = "__none__"

/** Create an issue in a project. Type/priority default to the first catalog entries; the key, initial
 *  status and reporter are assigned server-side. */
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
  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers(), enabled: open })
  const { data: issues = [] } = useQuery({
    queryKey: ["issues", projectId],
    queryFn: () => listIssues(projectId),
    enabled: open,
  })

  const resolvedType = issueTypeId || catalog?.issueTypes[0]?.id || ""
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
                  {catalog?.issueTypes.map((type) => (
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

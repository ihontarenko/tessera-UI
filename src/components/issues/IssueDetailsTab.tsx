import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Link2, Pencil, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { MemberChip } from "@/components/MemberChip"
import { IssueTypeLabel, PriorityBadge, StatusPill, formatStoryPoints } from "@/components/issues/issueVisuals"
import {
  addIssueLink,
  fetchCatalog,
  fetchLinkTypes,
  listIssues,
  removeIssueLink,
  setIssueParent,
  transitionIssue,
  updateIssue,
  updateIssueOrganization,
  type IssueDetail,
} from "@/api/issues"
import { searchMembers } from "@/api/members"
import { apiErrorMessage } from "@/api/errors"
import { memberName } from "@/lib/memberDisplay"

const UNASSIGNED = "__unassigned__"
const NO_PARENT = "__none__"
const CHOOSE = "__choose__"

interface Permissions {
  canEdit: boolean
  canTransition: boolean
}

/** The Details tab: read-out of every field plus inline editors for the fields (ticket 07), the
 *  workflow transition control (ticket 09), the parent (ticket 10), labels (ticket 11) and links
 *  (ticket 12). Each mutation returns the refreshed issue, which updates the shared query. */
export function IssueDetailsTab({ issue, permissions }: { issue: IssueDetail; permissions: Permissions }) {
  const queryClient = useQueryClient()
  const issueKey = ["issue", issue.id]

  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })
  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers() })
  const { data: linkTypes = [] } = useQuery({ queryKey: ["link-types"], queryFn: fetchLinkTypes })
  const { data: projectIssues = [] } = useQuery({
    queryKey: ["issues", issue.projectId],
    queryFn: () => listIssues(issue.projectId),
  })

  function applyUpdated(updated: IssueDetail) {
    queryClient.setQueryData(issueKey, updated)
    void queryClient.invalidateQueries({ queryKey: ["issues", issue.projectId] })
    void queryClient.invalidateQueries({ queryKey: ["history", issue.id] })
  }

  // ── Field editing ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [summary, setSummary] = useState(issue.summary)
  const [description, setDescription] = useState(issue.description ?? "")
  const [priorityId, setPriorityId] = useState(issue.priority?.id ?? "")
  const [assigneeMemberId, setAssigneeMemberId] = useState(issue.assignee?.id ?? UNASSIGNED)
  const [storyPoints, setStoryPoints] = useState(issue.storyPoints != null ? String(issue.storyPoints) : "")

  function startEditing() {
    setSummary(issue.summary)
    setDescription(issue.description ?? "")
    setPriorityId(issue.priority?.id ?? "")
    setAssigneeMemberId(issue.assignee?.id ?? UNASSIGNED)
    setStoryPoints(issue.storyPoints != null ? String(issue.storyPoints) : "")
    setEditing(true)
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateIssue(issue.id, {
        summary: summary.trim(),
        description: description.trim() || null,
        priorityId,
        assigneeMemberId: assigneeMemberId === UNASSIGNED ? null : assigneeMemberId,
        storyPoints: storyPoints.trim() ? Number(storyPoints) : null,
      }),
    onSuccess: (updated) => {
      applyUpdated(updated)
      setEditing(false)
      toast.success("Issue updated")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update the issue")),
  })

  // ── Transition ───────────────────────────────────────────────────────────────
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null)
  const [resolutionId, setResolutionId] = useState(CHOOSE)
  const pendingTransition = issue.availableTransitions.find((option) => option.toStatusId === pendingStatusId)

  const transitionMutation = useMutation({
    mutationFn: (input: { toStatusId: string; resolutionId?: string | null }) =>
      transitionIssue(issue.id, input.toStatusId, input.resolutionId),
    onSuccess: (updated) => {
      applyUpdated(updated)
      setPendingStatusId(null)
      setResolutionId(CHOOSE)
      toast.success("Issue transitioned")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not transition the issue")),
  })

  function chooseTransition(toStatusId: string) {
    const option = issue.availableTransitions.find((entry) => entry.toStatusId === toStatusId)
    if (!option) {
      return
    }
    if (option.requiresResolution) {
      setPendingStatusId(toStatusId)
    } else {
      transitionMutation.mutate({ toStatusId })
    }
  }

  // ── Parent ─────────────────────────────────────────────────────────────────────
  const parentMutation = useMutation({
    mutationFn: (parentId: string | null) => setIssueParent(issue.id, parentId),
    onSuccess: (updated) => {
      applyUpdated(updated)
      toast.success("Parent updated")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not set the parent")),
  })

  // ── Labels ───────────────────────────────────────────────────────────────────────
  const [labelsEditing, setLabelsEditing] = useState(false)
  const [labelsText, setLabelsText] = useState("")

  function startLabelsEditing() {
    setLabelsText(issue.labels.join(", "))
    setLabelsEditing(true)
  }

  const labelsMutation = useMutation({
    mutationFn: () =>
      updateIssueOrganization(issue.id, {
        labels: labelsText.split(",").map((label) => label.trim()).filter(Boolean),
      }),
    onSuccess: (updated) => {
      applyUpdated(updated)
      setLabelsEditing(false)
      toast.success("Labels updated")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update the labels")),
  })

  // ── Links ───────────────────────────────────────────────────────────────────────
  const [linkTypeId, setLinkTypeId] = useState(CHOOSE)
  const [targetIssueId, setTargetIssueId] = useState(CHOOSE)

  const addLinkMutation = useMutation({
    mutationFn: () => addIssueLink(issue.id, linkTypeId, targetIssueId),
    onSuccess: (updated) => {
      applyUpdated(updated)
      setLinkTypeId(CHOOSE)
      setTargetIssueId(CHOOSE)
      toast.success("Link added")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not add the link")),
  })

  const removeLinkMutation = useMutation({
    mutationFn: (linkId: string) => removeIssueLink(issue.id, linkId),
    onSuccess: (updated) => {
      applyUpdated(updated)
      toast.success("Link removed")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not remove the link")),
  })

  const linkableIssues = projectIssues.filter((row) => row.id !== issue.id)

  return (
    <div className="space-y-5">
      {/* Status + transition */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill status={issue.status} />
        {!issue.open && issue.resolution && <Badge variant="outline">{issue.resolution.name}</Badge>}
        {permissions.canTransition && issue.availableTransitions.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={CHOOSE} onValueChange={chooseTransition}>
              <SelectTrigger className="h-8 w-52">
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CHOOSE} disabled>
                  Move to…
                </SelectItem>
                {issue.availableTransitions.map((option) => (
                  <SelectItem key={option.transitionId} value={option.toStatusId}>
                    {option.name} → {option.toStatusName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Resolution prompt when a Done transition is pending */}
      {pendingTransition && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
          <div className="space-y-1.5">
            <Label>Resolution for “{pendingTransition.toStatusName}”</Label>
            <Select value={resolutionId} onValueChange={setResolutionId}>
              <SelectTrigger className="w-56">
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
          <Button
            size="sm"
            disabled={resolutionId === CHOOSE || transitionMutation.isPending}
            onClick={() => transitionMutation.mutate({ toStatusId: pendingTransition.toStatusId, resolutionId })}
          >
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPendingStatusId(null)}>
            Cancel
          </Button>
        </div>
      )}

      <Separator />

      {/* Summary / description + field editing */}
      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Summary</Label>
            <Input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={4000} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priorityId} onValueChange={setPriorityId}>
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
              <Label>Story points</Label>
              <Input type="number" min={0} step="0.5" value={storyPoints} onChange={(event) => setStoryPoints(event.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={summary.trim().length === 0 || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <IssueTypeLabel type={issue.type} />
              </div>
              <h3 className="text-base font-semibold">{issue.summary}</h3>
            </div>
            {permissions.canEdit && (
              <Button size="sm" variant="outline" onClick={startEditing}>
                <Pencil className="mr-1 size-3.5" /> Edit
              </Button>
            )}
          </div>
          {issue.description ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{issue.description}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">No description.</p>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Priority">
              <PriorityBadge priority={issue.priority} />
            </Field>
            <Field label="Story points">{formatStoryPoints(issue.storyPoints)}</Field>
            <Field label="Assignee">
              {issue.assignee ? <MemberChip member={issue.assignee} /> : <span className="text-muted-foreground">Unassigned</span>}
            </Field>
            <Field label="Reporter">
              {issue.reporter ? <MemberChip member={issue.reporter} /> : <span className="text-muted-foreground">—</span>}
            </Field>
          </dl>
        </div>
      )}

      <Separator />

      {/* Hierarchy */}
      <section className="space-y-2">
        <SectionTitle>Hierarchy</SectionTitle>
        <div className="text-sm">
          <span className="text-muted-foreground">Parent: </span>
          {issue.parent ? (
            <span className="font-mono">
              {issue.parent.issueKey} · {issue.parent.summary}
            </span>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </div>
        {permissions.canEdit && (
          <Select
            value={issue.parent?.id ?? NO_PARENT}
            onValueChange={(value) => parentMutation.mutate(value === NO_PARENT ? null : value)}
          >
            <SelectTrigger className="h-8 w-64">
              <SelectValue placeholder="Set parent…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>None</SelectItem>
              {linkableIssues.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.issueKey} · {row.summary}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {issue.children.length > 0 && (
          <div className="text-sm">
            <span className="text-muted-foreground">Children: </span>
            <span className="font-mono">{issue.children.map((child) => child.issueKey).join(", ")}</span>
          </div>
        )}
      </section>

      <Separator />

      {/* Labels */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionTitle>Labels</SectionTitle>
          {permissions.canEdit && !labelsEditing && (
            <Button size="sm" variant="ghost" onClick={startLabelsEditing}>
              Edit
            </Button>
          )}
        </div>

        {labelsEditing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Labels (comma-separated)</Label>
              <Input value={labelsText} onChange={(event) => setLabelsText(event.target.value)} placeholder="backend, urgent" />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setLabelsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={labelsMutation.isPending} onClick={() => labelsMutation.mutate()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 text-sm">
            <ChipRow label="Labels" values={issue.labels} />
          </div>
        )}
      </section>

      <Separator />

      {/* Links */}
      <section className="space-y-2">
        <SectionTitle>Links</SectionTitle>
        {issue.links.length === 0 && <p className="text-sm text-muted-foreground">No links.</p>}
        <ul className="space-y-1">
          {issue.links.map((link) => (
            <li key={link.id} className="flex items-center gap-2 text-sm">
              <Link2 className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{link.label}</span>
              <span className="font-mono">
                {link.issue.issueKey} · {link.issue.summary}
              </span>
              {permissions.canEdit && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeLinkMutation.mutate(link.id)}
                  aria-label="Remove link"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {permissions.canEdit && linkableIssues.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <Select value={linkTypeId} onValueChange={setLinkTypeId}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="Link type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CHOOSE} disabled>
                  Link type
                </SelectItem>
                {linkTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.outwardLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={targetIssueId} onValueChange={setTargetIssueId}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder="Target issue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CHOOSE} disabled>
                  Target issue
                </SelectItem>
                {linkableIssues.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.issueKey} · {row.summary}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={linkTypeId === CHOOSE || targetIssueId === CHOOSE || addLinkMutation.isPending}
              onClick={() => addLinkMutation.mutate()}
            >
              Add link
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h4>
}

function ChipRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      {values.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {values.map((value) => (
            <Badge key={value} variant="secondary">
              {value}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

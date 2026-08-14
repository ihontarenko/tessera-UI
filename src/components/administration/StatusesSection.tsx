import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusPill } from "@/components/issues/issueVisuals"
import {
  AdministrationSection,
  CatalogDialog,
  DeleteWithUsage,
  ReadOnlyNotice,
  RenameWarning,
  useCatalogMutation,
} from "@/components/administration/AdministrationPieces"
import {
  createStatus,
  deleteStatus,
  fetchConfigurationCounts,
  fetchStatusCategoryImpact,
  fetchStatusUsage,
  updateStatus,
  type StatusResponse,
} from "@/api/configurationAdministration"
import { fetchConfiguration } from "@/api/projects"
import type { StatusCategory } from "@/api/issues"

const CATEGORIES: Array<{ value: StatusCategory; label: string; hint: string }> = [
  { value: "TODO", label: "To Do", hint: "Not started" },
  { value: "IN_PROGRESS", label: "In Progress", hint: "Being worked on" },
  { value: "DONE", label: "Done", hint: "Finished — and what the board's last column holds" },
]

/**
 * The status catalog.
 *
 * ⚠️ **The category is the field that carries meaning.** It decides whether an issue in this status
 * counts as closed and which board column holds it when nothing maps it explicitly — so changing it
 * moves cards and changes what work already sitting there is taken to mean. That is allowed, and the
 * dialog says exactly how much of it there is before Save is offered.
 *
 * ⚠️ **A new status belongs to no workflow, and therefore to no project.** Membership is derived from
 * transitions, so a status joins a workflow when some edge names it — which is on the Workflows screen,
 * not this one. The banner says so, because otherwise the first thing an administrator does after
 * creating a status is wonder where it went.
 */
export function StatusesSection({ canAdminister }: { canAdminister: boolean }) {
  const [editing, setEditing] = useState<StatusResponse | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: configuration, refetch } = useQuery({ queryKey: ["configuration"], queryFn: fetchConfiguration })
  const { data: counts } = useQuery({ queryKey: ["administration", "counts"], queryFn: fetchConfigurationCounts })

  const statuses = configuration?.statuses ?? []
  const workflows = configuration?.workflows ?? []

  /** Which workflows name a status at either end — the whole of what "belongs to" means here. */
  function workflowsUsing(statusId: string) {
    return workflows
      .filter((workflow) =>
        workflow.transitions.some(
          (transition) => transition.fromStatusId === statusId || transition.toStatusId === statusId,
        ),
      )
      .map((workflow) => workflow.name)
  }

  return (
    <AdministrationSection
      title="Statuses"
      description="Every state an issue can be in. Shared by every project — a status enters one through a workflow, never directly."
      actions={
        canAdminister && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New status
          </Button>
        )
      }
    >
      {!canAdminister && <ReadOnlyNotice />}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead className="w-40">Category</TableHead>
            <TableHead>Used by workflows</TableHead>
            <TableHead className="w-24">Issues</TableHead>
            {canAdminister && <TableHead className="w-32" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {statuses.map((status) => {
            const using = workflowsUsing(status.id)

            return (
              <TableRow key={status.id}>
                <TableCell>
                  <StatusPill status={status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{status.category}</TableCell>
                <TableCell>
                  {using.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No workflow — add a transition into it to put it in one
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {using.map((workflowName) => (
                        <Badge key={workflowName} variant="outline">
                          {workflowName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{counts?.issuesByStatus[status.id] ?? 0}</TableCell>
                {canAdminister && (
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(status)}>
                        Edit
                      </Button>
                      <DeleteWithUsage
                        name={status.name}
                        noun="status"
                        usageQueryKey={["administration", "status-usage", status.id]}
                        fetchUsage={() => fetchStatusUsage(status.id)}
                        onDelete={() => deleteStatus(status.id)}
                        onDeleted={() => void refetch()}
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {creating && <StatusDialog onClose={() => setCreating(false)} onSaved={() => void refetch()} />}
      {editing && (
        <StatusDialog status={editing} onClose={() => setEditing(null)} onSaved={() => void refetch()} />
      )}
    </AdministrationSection>
  )
}

function StatusDialog({
  status,
  onClose,
  onSaved,
}: {
  status?: StatusResponse
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(status?.name ?? "")
  const [category, setCategory] = useState<StatusCategory>(status?.category ?? "TODO")

  const save = useCatalogMutation({
    mutationFn: () => {
      const request = { name: name.trim(), category }

      return status ? updateStatus(status.id, request) : createStatus(request)
    },
    success: status ? "Status updated" : "Status created",
    failure: "Could not save the status",
    onDone: () => {
      onSaved()
      onClose()
    },
  })

  return (
    <CatalogDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
      title={status ? `Edit ${status.name}` : "New status"}
      description="Statuses are shared by every project. The category decides what being in one means."
      submitLabel={status ? "Save" : "Create"}
      canSubmit={name.trim().length > 0}
      isPending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="status-name">Name</Label>
        <Input
          id="status-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status-category">Category</Label>
        <Select value={category} onValueChange={(value) => setCategory(value as StatusCategory)}>
          <SelectTrigger id="status-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} — {option.hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!status && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>It will belong to no workflow yet</AlertTitle>
          <AlertDescription>
            A status is in a workflow when some transition names it. Until you add one on the Workflows
            screen, no project can reach this status.
          </AlertDescription>
        </Alert>
      )}

      {status && <RenameWarning currentName={status.name} nextName={name} />}
      {status && category !== status.category && (
        <CategoryChangeImpact statusId={status.id} category={category} />
      )}
    </CatalogDialog>
  )
}

/**
 * What moving this status into another category would do, asked before Save is pressed.
 *
 * The counts come from the same resolution the board renders with, run against the proposed category —
 * so what it predicts and what happens cannot differ.
 */
function CategoryChangeImpact({ statusId, category }: { statusId: string; category: StatusCategory }) {
  const { data: impact } = useQuery({
    queryKey: ["administration", "status-category-impact", statusId, category],
    queryFn: () => fetchStatusCategoryImpact(statusId, category),
  })

  if (!impact) {
    return null
  }

  return (
    <Alert>
      <AlertTriangle className="size-4" />
      <AlertTitle>
        {impact.issuesHolding} issue{impact.issuesHolding === 1 ? "" : "s"} are in this status
      </AlertTitle>
      <AlertDescription className="space-y-1.5">
        <p>
          {impact.cardsChangingColumn === 0
            ? "No board card changes column — every board either maps this status explicitly or has nowhere else to put it."
            : `${impact.cardsChangingColumn} card${impact.cardsChangingColumn === 1 ? "" : "s"} would change column.`}
        </p>

        {impact.moves.length > 0 && (
          <ul className="space-y-0.5">
            {impact.moves.map((move) => (
              <li key={move.boardId} className="text-xs">
                <span className="font-mono">{move.projectKey}</span>{" "}
                <span className="text-muted-foreground">
                  {move.fromColumnName ?? "the backlog"} → {move.toColumnName ?? "the backlog"}
                </span>{" "}
                ({move.issueCount})
              </li>
            ))}
          </ul>
        )}

        {impact.openIssuesEnteringDone > 0 && (
          <p className="font-medium">
            {impact.openIssuesEnteringDone} of them have no resolution. Afterwards they are in a Done
            status and still open — which reads to everybody as “open, in the Done column”. Nothing here
            sets a resolution on your behalf.
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}

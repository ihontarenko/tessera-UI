import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ArrowRight, Flag, Plus, Trash2 } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jmouse/ui"
import { StatusPill } from "@/components/issues/issueVisuals"
import { sectionNavigationItemClass } from "@/lib/sectionNavigation"
import {
  AdministrationSection,
  CatalogDialog,
  DeleteWithUsage,
  ReadOnlyNotice,
  RenameWarning,
  UsageLine,
  useCatalogMutation,
} from "@/components/administration/AdministrationPieces"
import {
  addTransition,
  createWorkflow,
  deleteWorkflow,
  fetchTransitionRemovalImpact,
  fetchWorkflowBoardImpact,
  fetchWorkflowUsage,
  removeTransition,
  renameTransition,
  updateWorkflow,
  type WorkflowBoardImpact,
} from "@/api/configurationAdministration"
import { fetchConfiguration, type Configuration } from "@/api/projects"

type WorkflowView = Configuration["workflows"][number]
type StatusView = Configuration["statuses"][number]

/**
 * The workflow editor.
 *
 * **A list grouped by status, not a canvas.** Each status heading carries the edges that leave it, with
 * an add row beneath; the create transition gets its own section at the top because it is the one edge
 * with no source and the one the engine requires. Nothing here computes a coordinate — a graph drawn on
 * a canvas is a second layout problem on top of the one the browser already solves, and it does not
 * survive the font-scale zoom this application uses for text size.
 *
 * ⚠️ **"Add a status to this workflow" is "add a transition into it".** A workflow's statuses are
 * derived from its transitions and stored nowhere else, so membership is not a separate control — and an
 * editor offering one would be offering something with nothing behind it.
 */
export function WorkflowsSection({ canAdminister }: { canAdminister: boolean }) {
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: configuration, refetch } = useQuery({ queryKey: ["configuration"], queryFn: fetchConfiguration })

  const workflows = configuration?.workflows ?? []
  const statuses = configuration?.statuses ?? []
  const selected = workflows.find((workflow) => workflow.id === selectedId) ?? workflows[0] ?? null

  return (
    <AdministrationSection
      title="Workflows"
      description="Which statuses an issue can be in, and every move between them. A workflow is shared by every project whose scheme names it — a change here reaches all of them at once."
      actions={
        canAdminister && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New workflow
          </Button>
        )
      }
    >
      {!canAdminister && <ReadOnlyNotice />}

      <div className="flex flex-col gap-4 lg:flex-row">
        <nav className="lg:w-56 lg:shrink-0" aria-label="Workflows">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {workflows.map((workflow) => (
              <li key={workflow.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(workflow.id)}
                  aria-current={workflow.id === selected?.id ? "page" : undefined}
                  className={sectionNavigationItemClass(workflow.id === selected?.id)}
                >
                  {workflow.name}
                  <span className="ml-1.5 text-xs opacity-70">{workflow.transitions.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          {selected ? (
            <WorkflowEditor
              workflow={selected}
              statuses={statuses}
              canAdminister={canAdminister}
              onChanged={() => void refetch()}
              onDeleted={() => {
                setSelectedId(null)
                void refetch()
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No workflows yet.</p>
          )}
        </div>
      </div>

      {creating && (
        <CreateWorkflowDialog
          statuses={statuses}
          onClose={() => setCreating(false)}
          onSaved={(workflowId) => {
            setSelectedId(workflowId)
            void refetch()
          }}
        />
      )}
    </AdministrationSection>
  )
}

function WorkflowEditor({
  workflow,
  statuses,
  canAdminister,
  onChanged,
  onDeleted,
}: {
  workflow: WorkflowView
  statuses: StatusView[]
  canAdminister: boolean
  onChanged: () => void
  onDeleted: () => void
}) {
  const [editingDetails, setEditingDetails] = useState(false)

  const statusById = new Map(statuses.map((status) => [status.id, status]))
  const createTransitions = workflow.transitions.filter((transition) => !transition.fromStatusId)

  // Every status this workflow touches, at either end — which is the whole of what "its statuses" means.
  const involved = [
    ...new Set(
      workflow.transitions.flatMap((transition) =>
        transition.fromStatusId ? [transition.fromStatusId, transition.toStatusId] : [transition.toStatusId],
      ),
    ),
  ]

  const { data: usage } = useQuery({
    queryKey: ["administration", "workflow-usage", workflow.id],
    queryFn: () => fetchWorkflowUsage(workflow.id),
  })

  const { data: boardImpact } = useQuery({
    queryKey: ["administration", "workflow-board-impact", workflow.id],
    queryFn: () => fetchWorkflowBoardImpact(workflow.id),
  })

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
        <div className="space-y-1">
          <h3 className="font-medium">{workflow.name}</h3>
          {workflow.description && <p className="text-sm text-muted-foreground">{workflow.description}</p>}
          <div className="pt-1">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Used by</p>
            <UsageLine usage={usage} />
          </div>
        </div>
        {canAdminister && (
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" onClick={() => setEditingDetails(true)}>
              Edit
            </Button>
            <DeleteWithUsage
              name={workflow.name}
              noun="workflow"
              usageQueryKey={["administration", "workflow-usage", workflow.id]}
              fetchUsage={() => fetchWorkflowUsage(workflow.id)}
              onDelete={() => deleteWorkflow(workflow.id)}
              onDeleted={onDeleted}
            />
          </div>
        )}
      </header>

      <BoardImpactNotice impact={boardImpact} />

      <section className="space-y-2 rounded-md border p-3">
        <div className="flex items-center gap-1.5">
          <Flag className="size-3.5 text-muted-foreground" />
          <h4 className="text-sm font-medium">Created as</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          The one edge with no source, and the engine requires exactly one. Removing it would make issue
          creation fail for every project on this workflow.
        </p>
        {createTransitions.map((transition) => (
          <TransitionRow
            key={transition.id}
            workflowId={workflow.id}
            transitionId={transition.id}
            name={transition.name}
            target={statusById.get(transition.toStatusId) ?? null}
            canAdminister={canAdminister}
            onChanged={onChanged}
          />
        ))}
      </section>

      {involved.map((statusId) => (
        <StatusGroup
          key={statusId}
          workflow={workflow}
          statusId={statusId}
          statusById={statusById}
          statuses={statuses}
          canAdminister={canAdminister}
          onChanged={onChanged}
        />
      ))}

      {editingDetails && (
        <WorkflowDetailsDialog
          workflow={workflow}
          onClose={() => setEditingDetails(false)}
          onSaved={onChanged}
        />
      )}
    </div>
  )
}

/** One status heading, the edges that leave it, and a row for adding another. */
function StatusGroup({
  workflow,
  statusId,
  statusById,
  statuses,
  canAdminister,
  onChanged,
}: {
  workflow: WorkflowView
  statusId: string
  statusById: Map<string, StatusView>
  statuses: StatusView[]
  canAdminister: boolean
  onChanged: () => void
}) {
  const outgoing = workflow.transitions.filter((transition) => transition.fromStatusId === statusId)

  return (
    <section className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={statusById.get(statusId) ?? null} />
        {outgoing.length === 0 && (
          <Badge variant="secondary">terminal — nothing leaves it</Badge>
        )}
      </div>

      {outgoing.map((transition) => (
        <TransitionRow
          key={transition.id}
          workflowId={workflow.id}
          transitionId={transition.id}
          name={transition.name}
          target={statusById.get(transition.toStatusId) ?? null}
          canAdminister={canAdminister}
          onChanged={onChanged}
        />
      ))}

      {canAdminister && (
        <AddTransitionRow
          workflowId={workflow.id}
          fromStatusId={statusId}
          statuses={statuses}
          onChanged={onChanged}
        />
      )}
    </section>
  )
}

function TransitionRow({
  workflowId,
  transitionId,
  name,
  target,
  canAdminister,
  onChanged,
}: {
  workflowId: string
  transitionId: string
  name: string
  target: StatusView | null
  canAdminister: boolean
  onChanged: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(name)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)

  const rename = useCatalogMutation({
    mutationFn: () => renameTransition(workflowId, transitionId, draft.trim()),
    success: "Transition renamed",
    failure: "Could not rename the transition",
    onDone: () => {
      setRenaming(false)
      onChanged()
    },
  })

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5">
      <ArrowRight className="size-3.5 text-muted-foreground" />
      <StatusPill status={target} />
      {renaming ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            rename.mutate()
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-7 w-40"
            maxLength={64}
            autoFocus
          />
          <Button type="submit" size="sm" disabled={draft.trim().length === 0 || rename.isPending}>
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <span className="text-xs text-muted-foreground">{name}</span>
      )}

      {canAdminister && !renaming && (
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="sm" onClick={() => setRenaming(true)}>
            Rename
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${name}`}
            onClick={() => setConfirmingRemoval(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}

      {confirmingRemoval && (
        <RemoveTransitionDialog
          workflowId={workflowId}
          transitionId={transitionId}
          name={name}
          onClose={() => setConfirmingRemoval(false)}
          onRemoved={onChanged}
        />
      )}
    </div>
  )
}

/**
 * Removing an edge, with what the invariants say about it first.
 *
 * ⚠️ A **violation** refuses server-side whatever this dialog does; a **warning** — a status left with
 * no way out, and how many issues are in it — is reported and then obeyed. A terminal status is a real
 * thing and is indistinguishable from a mistake except by asking, which is what this is.
 */
function RemoveTransitionDialog({
  workflowId,
  transitionId,
  name,
  onClose,
  onRemoved,
}: {
  workflowId: string
  transitionId: string
  name: string
  onClose: () => void
  onRemoved: () => void
}) {
  const { data: verdict } = useQuery({
    queryKey: ["administration", "transition-removal-impact", workflowId, transitionId],
    queryFn: () => fetchTransitionRemovalImpact(workflowId, transitionId),
  })

  const remove = useCatalogMutation({
    mutationFn: () => removeTransition(workflowId, transitionId),
    success: "Transition removed",
    failure: "Could not remove the transition",
    onDone: () => {
      onRemoved()
      onClose()
    },
  })

  const blocked = (verdict?.violations.length ?? 0) > 0

  return (
    <CatalogDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
      title={`Remove “${name}”?`}
      description="This workflow is shared, so the move disappears for every project on it."
      submitLabel="Remove"
      canSubmit={!blocked}
      isPending={remove.isPending}
      onSubmit={() => remove.mutate()}
    >
      {verdict?.violations.map((violation) => (
        <Alert key={violation.rule} variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>This cannot be removed</AlertTitle>
          <AlertDescription>{violation.message}</AlertDescription>
        </Alert>
      ))}

      {verdict?.warnings.map((warning) => (
        <Alert key={`${warning.rule}-${warning.message}`}>
          <AlertTriangle className="size-4" />
          <AlertTitle>Worth knowing first</AlertTitle>
          <AlertDescription>{warning.message}</AlertDescription>
        </Alert>
      ))}

      {verdict && verdict.violations.length === 0 && verdict.warnings.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing is left stranded by removing this edge.</p>
      )}
    </CatalogDialog>
  )
}

/** Adding an edge out of a status — which is also how a status joins this workflow. */
function AddTransitionRow({
  workflowId,
  fromStatusId,
  statuses,
  onChanged,
}: {
  workflowId: string
  fromStatusId: string
  statuses: StatusView[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [toStatusId, setToStatusId] = useState("")

  const add = useCatalogMutation({
    mutationFn: () => addTransition(workflowId, { name: name.trim(), fromStatusId, toStatusId }),
    success: "Transition added",
    failure: "Could not add the transition",
    onDone: () => {
      setOpen(false)
      setName("")
      setToStatusId("")
      onChanged()
    },
  })

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add a move out of this status
      </Button>
    )
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-2.5"
      onSubmit={(event) => {
        event.preventDefault()
        add.mutate()
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`transition-target-${fromStatusId}`} className="text-xs">
          To
        </Label>
        <Select value={toStatusId} onValueChange={setToStatusId}>
          <SelectTrigger id={`transition-target-${fromStatusId}`} className="w-48">
            <SelectValue placeholder="Choose a status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status.id} value={status.id}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`transition-name-${fromStatusId}`} className="text-xs">
          Called
        </Label>
        <Input
          id={`transition-name-${fromStatusId}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Start progress"
          className="w-48"
          maxLength={64}
        />
      </div>

      <Button type="submit" size="sm" disabled={name.trim().length === 0 || !toStatusId || add.isPending}>
        {add.isPending ? "Adding…" : "Add"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>

      {/* The picker offers the whole catalog, so a status missing from it does not exist yet — and the
          screen that creates one is elsewhere. Without this line the honest conclusion from a short list
          is that the workflow, rather than the installation, is what limits the choice. */}
      <p className="basis-full text-xs text-muted-foreground">
        Only these statuses exist.{" "}
        <Link to="/administration?section=statuses" className="underline underline-offset-2">
          Create another one
        </Link>{" "}
        and it appears here.
      </p>
    </form>
  )
}

/** Which boards belonging to projects on this workflow currently show some of its statuses nowhere. */
function BoardImpactNotice({ impact }: { impact: WorkflowBoardImpact | undefined }) {
  if (!impact || impact.boards.length === 0) {
    return null
  }

  return (
    <Alert>
      <AlertTriangle className="size-4" />
      <AlertTitle>
        {impact.boards.length} board{impact.boards.length === 1 ? "" : "s"} hold statuses no column maps
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>
          Work in those statuses lands in the backlog rather than on the board. That is legal — unmapping a
          status is how a project decides what its backlog contains — but it is also what happens by
          accident when a shared workflow grows a status. Nothing here re-provisions a board; columns are
          the project administrator&apos;s.
        </p>
        <ul className="space-y-0.5">
          {impact.boards.map((board) => (
            <li key={board.boardId} className="text-xs">
              <span className="font-mono">{board.projectKey}</span>{" "}
              <span className="text-muted-foreground">
                {board.unmappedStatuses.map((status) => status.name).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function WorkflowDetailsDialog({
  workflow,
  onClose,
  onSaved,
}: {
  workflow: WorkflowView
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(workflow.name)
  const [description, setDescription] = useState(workflow.description ?? "")

  const save = useCatalogMutation({
    mutationFn: () =>
      updateWorkflow(workflow.id, {
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
      }),
    success: "Workflow updated",
    failure: "Could not save the workflow",
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
      title={`Edit ${workflow.name}`}
      description="The workflow's own two fields. Its shape is its transitions, edited on the screen behind this."
      submitLabel="Save"
      canSubmit={name.trim().length > 0}
      isPending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="workflow-name">Name</Label>
        <Input
          id="workflow-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="workflow-description">Description</Label>
        <Input
          id="workflow-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={255}
        />
      </div>

      <RenameWarning currentName={workflow.name} nextName={name} />
    </CatalogDialog>
  )
}

/**
 * A workflow and its first status, together.
 *
 * ⚠️ The initial status is not optional: a workflow with no create transition makes issue creation throw
 * for every project on it, so there is deliberately no moment in which one exists.
 */
function CreateWorkflowDialog({
  statuses,
  onClose,
  onSaved,
}: {
  statuses: StatusView[]
  onClose: () => void
  onSaved: (workflowId: string) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [initialStatusId, setInitialStatusId] = useState("")
  const [createTransitionName, setCreateTransitionName] = useState("Create")

  const save = useCatalogMutation({
    mutationFn: () =>
      createWorkflow({
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
        initialStatusId,
        createTransitionName: createTransitionName.trim().length > 0 ? createTransitionName.trim() : null,
      }),
    success: "Workflow created",
    failure: "Could not create the workflow",
    onDone: (created) => {
      onSaved(created.workflow.id)
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
      title="New workflow"
      description="A workflow starts with the status new issues land in. Everything else is a transition you add afterwards."
      submitLabel="Create"
      canSubmit={name.trim().length > 0 && initialStatusId.length > 0}
      isPending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-workflow-name">Name</Label>
        <Input
          id="new-workflow-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-workflow-description">Description</Label>
        <Input
          id="new-workflow-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={255}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-workflow-initial">New issues land in</Label>
        <Select value={initialStatusId} onValueChange={setInitialStatusId}>
          <SelectTrigger id="new-workflow-initial">
            <SelectValue placeholder="Choose a status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status.id} value={status.id}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-workflow-create-name">The create transition is called</Label>
        <Input
          id="new-workflow-create-name"
          value={createTransitionName}
          onChange={(event) => setCreateTransitionName(event.target.value)}
          maxLength={64}
        />
      </div>
    </CatalogDialog>
  )
}

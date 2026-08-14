import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AdministrationSection,
  CatalogDialog,
  DeleteWithUsage,
  ReadOnlyNotice,
  RenameWarning,
  useCatalogMutation,
} from "@/components/administration/AdministrationPieces"
import {
  createPriority,
  deletePriority,
  fetchConfigurationCounts,
  fetchPriorityUsage,
  listPriorities,
  reorderPriorities,
  updatePriority,
  type PriorityResponse,
} from "@/api/configurationAdministration"

/**
 * The priority catalog.
 *
 * ⚠️ **The order is part of the catalog, not part of a row.** A priority's `sequence` is what a picker
 * offers them in, so the up/down controls send the whole list rather than a move — two administrators
 * each applying a move to a list the other has already changed produce an order neither asked for.
 */
export function PrioritiesSection({ canAdminister }: { canAdminister: boolean }) {
  const [editing, setEditing] = useState<PriorityResponse | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: priorities = [], refetch } = useQuery({
    queryKey: ["administration", "priorities"],
    queryFn: listPriorities,
  })

  const { data: counts } = useQuery({
    queryKey: ["administration", "counts"],
    queryFn: fetchConfigurationCounts,
  })

  const reorder = useCatalogMutation({
    mutationFn: (orderedIds: string[]) => reorderPriorities(orderedIds),
    success: "Priority order saved",
    failure: "Could not reorder the priorities",
    onDone: () => void refetch(),
  })

  function move(index: number, delta: number) {
    const next = priorities.map((priority) => priority.id)
    const target = index + delta

    if (target < 0 || target >= next.length) {
      return
    }

    ;[next[index], next[target]] = [next[target], next[index]]
    reorder.mutate(next)
  }

  return (
    <AdministrationSection
      title="Priorities"
      description="How urgent an issue is. One catalog for every project — an issue must be given one to be created, so this list can never be empty."
      actions={
        canAdminister && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New priority
          </Button>
        )
      }
    >
      {!canAdminister && <ReadOnlyNotice />}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Order</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-28">Colour</TableHead>
            <TableHead className="w-32">Issues</TableHead>
            {canAdminister && <TableHead className="w-40" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {priorities.map((priority, index) => (
            <TableRow key={priority.id}>
              <TableCell className="text-xs text-muted-foreground">{priority.sequence}</TableCell>
              <TableCell className="font-medium">{priority.name}</TableCell>
              <TableCell>
                {priority.color ? (
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      className="size-3 rounded-full border"
                      style={{ backgroundColor: priority.color }}
                      aria-hidden
                    />
                    <code>{priority.color}</code>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">{counts?.issuesByPriority[priority.id] ?? 0}</TableCell>
              {canAdminister && (
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Move ${priority.name} up`}
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Move ${priority.name} down`}
                      disabled={index === priorities.length - 1 || reorder.isPending}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(priority)}>
                      Edit
                    </Button>
                    <DeleteWithUsage
                      name={priority.name}
                      noun="priority"
                      usageQueryKey={["administration", "priority-usage", priority.id]}
                      fetchUsage={() => fetchPriorityUsage(priority.id)}
                      onDelete={() => deletePriority(priority.id)}
                      onDeleted={() => void refetch()}
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {creating && <PriorityDialog onClose={() => setCreating(false)} onSaved={() => void refetch()} />}
      {editing && (
        <PriorityDialog
          priority={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void refetch()}
        />
      )}
    </AdministrationSection>
  )
}

function PriorityDialog({
  priority,
  onClose,
  onSaved,
}: {
  priority?: PriorityResponse
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(priority?.name ?? "")
  const [color, setColor] = useState(priority?.color ?? "")

  const save = useCatalogMutation({
    mutationFn: () => {
      const request = { name: name.trim(), color: color.trim().length > 0 ? color.trim() : null }

      return priority ? updatePriority(priority.id, request) : createPriority(request)
    },
    success: priority ? "Priority updated" : "Priority created",
    failure: "Could not save the priority",
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
      title={priority ? `Edit ${priority.name}` : "New priority"}
      description="Priorities are shared by every project. A new one is added to the end of the picker."
      submitLabel={priority ? "Save" : "Create"}
      canSubmit={name.trim().length > 0}
      isPending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="priority-name">Name</Label>
        <Input
          id="priority-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="priority-color">Colour</Label>
        <Input
          id="priority-color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          placeholder="#ef4444"
          maxLength={16}
        />
        <p className="text-xs text-muted-foreground">Any CSS colour. Blank renders the arrow unstyled.</p>
      </div>

      {priority && <RenameWarning currentName={priority.name} nextName={name} />}
    </CatalogDialog>
  )
}

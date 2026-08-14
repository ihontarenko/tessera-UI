import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
  createResolution,
  deleteResolution,
  fetchConfigurationCounts,
  fetchResolutionUsage,
  listResolutions,
  updateResolution,
  type ResolutionResponse,
} from "@/api/configurationAdministration"

/**
 * The resolution catalog — the reasons an issue may close.
 *
 * ⚠️ **A resolution is what "closed" means.** An issue is open exactly while it has none (ADR-0004), and
 * a transition into a Done-category status is what sets one. That is why the last resolution cannot be
 * deleted even when no issue holds one: the failure would arrive at the next thing anybody finishes.
 */
export function ResolutionsSection({ canAdminister }: { canAdminister: boolean }) {
  const [editing, setEditing] = useState<ResolutionResponse | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: resolutions = [], refetch } = useQuery({
    queryKey: ["administration", "resolutions"],
    queryFn: listResolutions,
  })

  const { data: counts } = useQuery({
    queryKey: ["administration", "counts"],
    queryFn: fetchConfigurationCounts,
  })

  return (
    <AdministrationSection
      title="Resolutions"
      description="Why an issue closed. An issue is open exactly while it has none, so this list decides what finishing something can mean — and it can never be empty."
      actions={
        canAdminister && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New resolution
          </Button>
        )
      }
    >
      {!canAdminister && <ReadOnlyNotice />}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-40">Issues closed with it</TableHead>
            {canAdminister && <TableHead className="w-32" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {resolutions.map((resolution) => (
            <TableRow key={resolution.id}>
              <TableCell className="font-medium">{resolution.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{resolution.description ?? "—"}</TableCell>
              <TableCell className="text-sm">{counts?.issuesByResolution[resolution.id] ?? 0}</TableCell>
              {canAdminister && (
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(resolution)}>
                      Edit
                    </Button>
                    <DeleteWithUsage
                      name={resolution.name}
                      noun="resolution"
                      usageQueryKey={["administration", "resolution-usage", resolution.id]}
                      fetchUsage={() => fetchResolutionUsage(resolution.id)}
                      onDelete={() => deleteResolution(resolution.id)}
                      onDeleted={() => void refetch()}
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {creating && <ResolutionDialog onClose={() => setCreating(false)} onSaved={() => void refetch()} />}
      {editing && (
        <ResolutionDialog
          resolution={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void refetch()}
        />
      )}
    </AdministrationSection>
  )
}

function ResolutionDialog({
  resolution,
  onClose,
  onSaved,
}: {
  resolution?: ResolutionResponse
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(resolution?.name ?? "")
  const [description, setDescription] = useState(resolution?.description ?? "")

  const save = useCatalogMutation({
    mutationFn: () => {
      const request = {
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
      }

      return resolution ? updateResolution(resolution.id, request) : createResolution(request)
    },
    success: resolution ? "Resolution updated" : "Resolution created",
    failure: "Could not save the resolution",
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
      title={resolution ? `Edit ${resolution.name}` : "New resolution"}
      description="Resolutions are shared by every project, and offered by any transition into a Done status."
      submitLabel={resolution ? "Save" : "Create"}
      canSubmit={name.trim().length > 0}
      isPending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="resolution-name">Name</Label>
        <Input
          id="resolution-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="resolution-description">Description</Label>
        <Input
          id="resolution-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What choosing this one means"
          maxLength={255}
        />
      </div>

      {resolution && <RenameWarning currentName={resolution.name} nextName={name} />}
    </CatalogDialog>
  )
}

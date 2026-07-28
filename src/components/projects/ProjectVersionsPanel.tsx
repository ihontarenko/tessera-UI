import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/EmptyState"
import {
  createVersion,
  deleteVersion,
  listVersions,
  updateVersion,
  type VersionResponse,
  type VersionState,
} from "@/api/issues"
import { apiErrorMessage } from "@/api/errors"

const STATES: Array<{ value: VersionState; label: string }> = [
  { value: "UNRELEASED", label: "Unreleased" },
  { value: "RELEASED", label: "Released" },
  { value: "ARCHIVED", label: "Archived" },
]

const STATE_LABELS: Record<VersionState, string> = {
  UNRELEASED: "Unreleased",
  RELEASED: "Released",
  ARCHIVED: "Archived",
}

/** Version administration for a project (ticket 06). Carries a lifecycle state, never released/archived
 *  booleans. Mutating controls require ADMINISTER_PROJECT. */
export function ProjectVersionsPanel({ projectId, canAdminister }: { projectId: string; canAdminister: boolean }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<VersionResponse | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const versionsKey = ["versions", projectId]
  const { data: versions, isLoading } = useQuery({ queryKey: versionsKey, queryFn: () => listVersions(projectId) })

  const deleteMutation = useMutation({
    mutationFn: (versionId: string) => deleteVersion(projectId, versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: versionsKey })
      toast.success("Version deleted")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the version")),
  })

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  return (
    <div className="space-y-4">
      {canAdminister && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            New version
          </Button>
        </div>
      )}

      {versions && versions.length === 0 ? (
        <EmptyState icon={Tag} title="No versions" message="Tie issues to releases with versions." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Release date</TableHead>
              <TableHead>Description</TableHead>
              {canAdminister && <TableHead className="w-32 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions?.map((version) => (
              <TableRow key={version.id}>
                <TableCell className="font-medium">{version.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{STATE_LABELS[version.state]}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{version.releaseDate || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{version.description || "—"}</TableCell>
                {canAdminister && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(version)
                          setDialogOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(version.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <VersionFormDialog projectId={projectId} version={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function VersionFormDialog({
  projectId,
  version,
  open,
  onOpenChange,
}: {
  projectId: string
  version: VersionResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [releaseDate, setReleaseDate] = useState("")
  const [state, setState] = useState<VersionState>("UNRELEASED")

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(version?.name ?? "")
      setDescription(version?.description ?? "")
      setReleaseDate(version?.releaseDate ?? "")
      setState(version?.state ?? "UNRELEASED")
    }
    onOpenChange(next)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const request = {
        name: name.trim(),
        description: description.trim() || null,
        releaseDate: releaseDate || null,
        state,
      }
      return version ? updateVersion(projectId, version.id, request) : createVersion(projectId, request)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["versions", projectId] })
      toast.success(version ? "Version updated" : "Version created")
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not save the version")),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{version ? "Edit version" : "New version"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) {
              mutation.mutate()
            }
          }}
        >
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={128} autoFocus placeholder="1.0.0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select value={state} onValueChange={(value) => setState(value as VersionState)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Release date</Label>
              <Input type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={255} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={name.trim().length === 0 || mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

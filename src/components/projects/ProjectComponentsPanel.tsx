import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Boxes } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import {
  createComponent,
  deleteComponent,
  listComponents,
  updateComponent,
  type ComponentResponse,
} from "@/api/issues"
import { searchMembers } from "@/api/members"
import { apiErrorMessage } from "@/api/errors"
import { memberName } from "@/lib/memberDisplay"

const NO_LEAD = "__none__"

/** Component administration for a project (ticket 06). Visible to members; the mutating controls
 *  require ADMINISTER_PROJECT (backend-enforced, hidden here when the caller lacks it). */
export function ProjectComponentsPanel({ projectId, canAdminister }: { projectId: string; canAdminister: boolean }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ComponentResponse | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const componentsKey = ["components", projectId]
  const { data: components, isLoading } = useQuery({ queryKey: componentsKey, queryFn: () => listComponents(projectId) })

  const deleteMutation = useMutation({
    mutationFn: (componentId: string) => deleteComponent(projectId, componentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: componentsKey })
      toast.success("Component deleted")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the component")),
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
            New component
          </Button>
        </div>
      )}

      {components && components.length === 0 ? (
        <EmptyState icon={Boxes} title="No components" message="Group issues by area of the system." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Description</TableHead>
              {canAdminister && <TableHead className="w-32 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {components?.map((component) => (
              <TableRow key={component.id}>
                <TableCell className="font-medium">{component.name}</TableCell>
                <TableCell>
                  {component.lead ? <MemberChip member={component.lead} /> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{component.description || "—"}</TableCell>
                {canAdminister && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(component)
                          setDialogOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(component.id)}
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

      <ComponentFormDialog
        projectId={projectId}
        component={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}

function ComponentFormDialog({
  projectId,
  component,
  open,
  onOpenChange,
}: {
  projectId: string
  component: ComponentResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [leadMemberId, setLeadMemberId] = useState(NO_LEAD)
  const [description, setDescription] = useState("")

  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers(), enabled: open })

  // Seed the form whenever the dialog opens for a (possibly different) component.
  function handleOpenChange(next: boolean) {
    if (next) {
      setName(component?.name ?? "")
      setLeadMemberId(component?.lead?.id ?? NO_LEAD)
      setDescription(component?.description ?? "")
    }
    onOpenChange(next)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const request = {
        name: name.trim(),
        leadMemberId: leadMemberId === NO_LEAD ? null : leadMemberId,
        description: description.trim() || null,
      }
      return component ? updateComponent(projectId, component.id, request) : createComponent(projectId, request)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["components", projectId] })
      toast.success(component ? "Component updated" : "Component created")
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not save the component")),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <span className="hidden" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{component ? "Edit component" : "New component"}</DialogTitle>
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
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={128} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Lead</Label>
            <Select value={leadMemberId} onValueChange={setLeadMemberId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LEAD}>None</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {memberName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jmouse/ui"
import { ProjectRolePicker } from "@/components/projects/ProjectRolePicker"
import { addProjectMember, type ProjectMember } from "@/api/projects"
import { searchMembers } from "@/api/members"
import { apiErrorMessage } from "@/api/errors"
import { memberName } from "@/lib/memberDisplay"

interface AddMemberDialogProperties {
  projectId: string
  existingMemberIds: string[]
}

export function AddMemberDialog({ projectId, existingMemberIds }: AddMemberDialogProperties) {
  const [open, setOpen] = useState(false)
  const [memberId, setMemberId] = useState("")
  const [roleNames, setRoleNames] = useState<string[]>([])

  const queryClient = useQueryClient()

  const { data: allMembers = [] } = useQuery({
    queryKey: ["members", "all"],
    queryFn: () => searchMembers(),
    enabled: open,
  })

  const selectableMembers = useMemo(
    () => allMembers.filter((member) => !existingMemberIds.includes(member.id)),
    [allMembers, existingMemberIds],
  )

  const mutation = useMutation({
    mutationFn: () => addProjectMember(projectId, memberId, roleNames),
    onSuccess: (members: ProjectMember[]) => {
      queryClient.setQueryData(["project-members", projectId], members)
      toast.success("Member added")
      reset()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not add the member")),
  })

  function reset() {
    setOpen(false)
    setMemberId("")
    setRoleNames([])
  }

  function toggleRole(roleName: string) {
    setRoleNames((current) =>
      current.includes(roleName) ? current.filter((held) => held !== roleName) : [...current, roleName],
    )
  }

  const canSubmit = memberId.length > 0 && roleNames.length > 0

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : reset())}>
      <DialogTrigger asChild>
        <Button size="sm">Add member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>Grant a member one or more roles in this project.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-member">Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger id="add-member">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {selectableMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {memberName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectableMembers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Everyone who has signed in is already a member. New people appear here once they sign in.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Roles</Label>
            <ProjectRolePicker selected={roleNames} onToggle={toggleRole} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={reset}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Adding…" : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

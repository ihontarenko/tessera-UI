import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RoleToggleGroup } from "@/components/projects/RoleToggleGroup"
import { MemberChip } from "@/components/MemberChip"
import {
  clearPermissionOverride,
  fetchPermissions,
  fetchProjectRoles,
  setMemberRoles,
  setPermissionOverride,
  type PermissionEffect,
  type ProjectMember,
} from "@/api/projects"
import { apiErrorMessage } from "@/api/errors"
import { useQuery } from "@tanstack/react-query"

type OverrideChoice = "INHERIT" | PermissionEffect

interface ManageAccessDialogProperties {
  projectId: string
  member: ProjectMember | null
  onOpenChange: (open: boolean) => void
}

/**
 * Manage one member's access: their roles (replace-the-set, additive) and per-permission ALLOW/DENY
 * overrides. Changes apply immediately; the server response (which the deny-wins model computes) is
 * written straight back to the members cache, so the row always reflects the truth.
 */
export function ManageAccessDialog({ projectId, member, onOpenChange }: ManageAccessDialogProperties) {
  const queryClient = useQueryClient()
  const { data: roles = [] } = useQuery({ queryKey: ["project-roles"], queryFn: fetchProjectRoles })
  const { data: permissions = [] } = useQuery({ queryKey: ["permissions"], queryFn: fetchPermissions })

  function replaceMember(updated: ProjectMember) {
    queryClient.setQueryData<ProjectMember[]>(["project-members", projectId], (current) =>
      current ? current.map((entry) => (entry.member.id === updated.member.id ? updated : entry)) : [updated],
    )
  }

  const rolesMutation = useMutation({
    mutationFn: (roleIds: string[]) => setMemberRoles(projectId, member!.member.id, roleIds),
    onSuccess: replaceMember,
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update roles")),
  })

  const overrideMutation = useMutation({
    mutationFn: ({ permissionId, choice }: { permissionId: string; choice: OverrideChoice }) =>
      choice === "INHERIT"
        ? clearPermissionOverride(projectId, member!.member.id, permissionId)
        : setPermissionOverride(projectId, member!.member.id, permissionId, choice),
    onSuccess: replaceMember,
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update the override")),
  })

  if (!member) {
    return null
  }

  const selectedRoleIds = member.roles.map((role) => role.id)

  function toggleRole(roleId: string) {
    const next = selectedRoleIds.includes(roleId)
      ? selectedRoleIds.filter((id) => id !== roleId)
      : [...selectedRoleIds, roleId]

    if (next.length === 0) {
      toast.error("A member must keep at least one role")
      return
    }

    rolesMutation.mutate(next)
  }

  function choiceFor(permissionId: string): OverrideChoice {
    const override = member!.overrides.find((entry) => entry.permissionId === permissionId)
    return override ? override.effect : "INHERIT"
  }

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription>Roles and individual permission overrides (deny wins).</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <MemberChip member={member.member} subtitle={member.member.email} />

          <div className="space-y-2">
            <Label>Roles</Label>
            <RoleToggleGroup roles={roles} selectedIds={selectedRoleIds} onToggle={toggleRole} />
          </div>

          <div className="space-y-2">
            <Label>Permission overrides</Label>
            <div className="space-y-1.5">
              {permissions.map((permission) => (
                <div key={permission.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs">{permission.name}</div>
                    {permission.description && (
                      <div className="truncate text-xs text-muted-foreground">{permission.description}</div>
                    )}
                  </div>
                  <Select
                    value={choiceFor(permission.id)}
                    onValueChange={(value) =>
                      overrideMutation.mutate({ permissionId: permission.id, choice: value as OverrideChoice })
                    }
                  >
                    <SelectTrigger className="w-32 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INHERIT">Inherit</SelectItem>
                      <SelectItem value="ALLOW">Allow</SelectItem>
                      <SelectItem value="DENY">Deny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

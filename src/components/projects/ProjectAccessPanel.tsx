import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { AddMemberDialog } from "@/components/projects/AddMemberDialog"
import { ProjectRolePicker } from "@/components/projects/ProjectRolePicker"
import {
  listProjectMembers,
  removeProjectMember,
  setMemberRoles,
  type ProjectMember,
} from "@/api/projects"
import { roleLabel } from "@/api/roles"
import { apiErrorMessage } from "@/api/errors"

interface ProjectAccessPanelProperties {
  projectId: string
  canAdminister: boolean
}

/**
 * Who is in this project and what role they hold here.
 *
 * ⚠️ **There is no "Manage access" dialog any more, and no permission column.** A per-person allow or
 * deny inside one project was a second answer to what somebody may do — one the roles screen could not
 * see and nobody maintaining the roles would ever find. What a role carries is edited once,
 * installation-wide, behind `access:administer`; this screen only decides which of the three roles a
 * person holds *here*, which is the one project-shaped question left.
 *
 * Roles are therefore edited in the row itself rather than behind a modal: three pills, clicked, saved.
 * Listing is visible to any member; the controls appear only for an administrator (and the server
 * enforces that regardless).
 */
export function ProjectAccessPanel({ projectId, canAdminister }: ProjectAccessPanelProperties) {
  const queryClient = useQueryClient()

  const { data: members, isLoading } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => listProjectMembers(projectId),
  })

  function replaceMember(updated: ProjectMember) {
    queryClient.setQueryData<ProjectMember[]>(["project-members", projectId], (current) =>
      current ? current.map((entry) => (entry.member.id === updated.member.id ? updated : entry)) : [updated],
    )
  }

  const rolesMutation = useMutation({
    mutationFn: ({ memberId, roleNames }: { memberId: string; roleNames: string[] }) =>
      setMemberRoles(projectId, memberId, roleNames),
    onSuccess: replaceMember,
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update roles")),
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeProjectMember(projectId, memberId),
    onSuccess: (_result, memberId) => {
      queryClient.setQueryData<ProjectMember[]>(["project-members", projectId], (current) =>
        current ? current.filter((entry) => entry.member.id !== memberId) : [],
      )
      toast.success("Member removed")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not remove the member")),
  })

  /**
   * ⚠️ The last role cannot be taken away here — somebody holding none is not a member at all, and
   * "Remove" is the honest way to say that. The server refuses it too.
   */
  function toggleRole(entry: ProjectMember, roleName: string) {
    const roleNames = entry.roles.includes(roleName)
      ? entry.roles.filter((held) => held !== roleName)
      : [...entry.roles, roleName]

    if (roleNames.length === 0) {
      toast.error("A member must keep at least one role — remove them instead")
      return
    }

    rolesMutation.mutate({ memberId: entry.member.id, roleNames })
  }

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  return (
    <div className="space-y-4">
      {canAdminister && (
        <div className="flex justify-end">
          <AddMemberDialog projectId={projectId} existingMemberIds={(members ?? []).map((entry) => entry.member.id)} />
        </div>
      )}

      {members && members.length === 0 ? (
        <EmptyState icon={Users} title="No members" message="Add members to give people access to this project." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Roles</TableHead>
              {canAdminister && <TableHead className="w-24 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((entry) => (
              <TableRow key={entry.member.id}>
                <TableCell>
                  <MemberChip member={entry.member} subtitle={entry.member.email} />
                </TableCell>
                <TableCell>
                  {canAdminister ? (
                    <ProjectRolePicker
                      selected={entry.roles}
                      disabled={rolesMutation.isPending}
                      onToggle={(roleName) => toggleRole(entry, roleName)}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {entry.roles.map((roleName) => (
                        <Badge key={roleName} variant="secondary">
                          {roleLabel(roleName)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                {canAdminister && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeMutation.mutate(entry.member.id)}
                      disabled={removeMutation.isPending}
                    >
                      Remove
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

import { useState } from "react"
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
import { ManageAccessDialog } from "@/components/projects/ManageAccessDialog"
import { listProjectMembers, removeProjectMember, type ProjectMember } from "@/api/projects"
import { apiErrorMessage } from "@/api/errors"

interface ProjectAccessPanelProperties {
  projectId: string
  canAdminister: boolean
}

/**
 * The people/access settings area — members, their roles, and their permission overrides. Listing is
 * visible to any member; the add/remove/manage controls appear only when the caller can administer
 * the project (the backend enforces it regardless).
 */
export function ProjectAccessPanel({ projectId, canAdminister }: ProjectAccessPanelProperties) {
  const queryClient = useQueryClient()
  const [managing, setManaging] = useState<ProjectMember | null>(null)

  const { data: members, isLoading } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => listProjectMembers(projectId),
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
              <TableHead>Overrides</TableHead>
              {canAdminister && <TableHead className="w-40 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((entry) => (
              <TableRow key={entry.member.id}>
                <TableCell>
                  <MemberChip member={entry.member} subtitle={entry.member.email} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {entry.roles.map((role) => (
                      <Badge key={role.id} variant="secondary">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {entry.overrides.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {entry.overrides.map((override) => (
                      <Badge
                        key={override.permissionId}
                        variant={override.effect === "DENY" ? "destructive" : "outline"}
                      >
                        {override.effect === "DENY" ? "−" : "+"} {override.permissionName}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                {canAdminister && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setManaging(entry)}>
                        Manage
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeMutation.mutate(entry.member.id)}
                        disabled={removeMutation.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ManageAccessDialog
        projectId={projectId}
        member={managing}
        onOpenChange={(open) => {
          if (!open) {
            setManaging(null)
          }
        }}
      />
    </div>
  )
}

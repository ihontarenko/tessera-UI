import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  fetchConfiguration,
  updateProject,
  type ProjectResponse,
} from "@/api/projects"
import { searchMembers } from "@/api/members"
import { apiErrorMessage } from "@/api/errors"
import { memberName } from "@/lib/memberDisplay"

/**
 * Edit a project's name, lead and schemes. Rendered only when the caller holds
 * {@code ADMINISTER_PROJECT} — the parent tab gates it; the backend enforces it regardless.
 */
export function ProjectSettingsForm({ project }: { project: ProjectResponse }) {
  const queryClient = useQueryClient()

  const [name, setName] = useState(project.name)
  const [leadMemberId, setLeadMemberId] = useState(project.lead?.id ?? "")
  const [issueTypeSchemeId, setIssueTypeSchemeId] = useState(project.issueTypeScheme?.id ?? "")
  const [workflowSchemeId, setWorkflowSchemeId] = useState(project.workflowScheme?.id ?? "")

  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers() })
  const { data: configuration } = useQuery({ queryKey: ["configuration"], queryFn: fetchConfiguration })

  const mutation = useMutation({
    mutationFn: () => updateProject(project.id, { name: name.trim(), leadMemberId, issueTypeSchemeId, workflowSchemeId }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["project", project.id], updated)
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
      toast.success("Project updated")
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update the project")),
  })

  const canSubmit = name.trim().length > 0 && leadMemberId && issueTypeSchemeId && workflowSchemeId

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) {
          mutation.mutate()
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="settings-name">Name</Label>
        <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={128} />
      </div>

      <div className="space-y-1.5">
        <Label>Key</Label>
        <Input value={project.key} disabled className="font-mono" />
        <p className="text-xs text-muted-foreground">The key is fixed once a project exists.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-lead">Lead</Label>
        <Select value={leadMemberId} onValueChange={setLeadMemberId}>
          <SelectTrigger id="settings-lead">
            <SelectValue placeholder="Select a lead" />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {memberName(member)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-issue-type-scheme">Issue type scheme</Label>
        <Select value={issueTypeSchemeId} onValueChange={setIssueTypeSchemeId}>
          <SelectTrigger id="settings-issue-type-scheme">
            <SelectValue placeholder="Select a scheme" />
          </SelectTrigger>
          <SelectContent>
            {configuration?.issueTypeSchemes.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id}>
                {scheme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-workflow-scheme">Workflow scheme</Label>
        <Select value={workflowSchemeId} onValueChange={setWorkflowSchemeId}>
          <SelectTrigger id="settings-workflow-scheme">
            <SelectValue placeholder="Select a scheme" />
          </SelectTrigger>
          <SelectContent>
            {configuration?.workflowSchemes.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id}>
                {scheme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={!canSubmit || mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}

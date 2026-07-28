import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createProject, type ProjectType } from "@/api/projects"
import { searchMembers } from "@/api/members"
import { apiErrorMessage } from "@/api/errors"
import { memberName } from "@/lib/memberDisplay"

const KEY_PATTERN = /^[A-Z][A-Z0-9]*$/
const SELF_LEAD = "__self__"

const PROJECT_TYPES: Array<{ value: ProjectType; label: string; hint: string }> = [
  { value: "SCRUM", label: "Scrum", hint: "Sprints, backlog and a full workflow." },
  { value: "KANBAN", label: "Kanban", hint: "A continuous-flow board and full workflow." },
  { value: "TODO", label: "Todo", hint: "A lightweight flat checklist." },
]

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [type, setType] = useState<ProjectType>("SCRUM")
  const [leadMemberId, setLeadMemberId] = useState<string>(SELF_LEAD)

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: members = [] } = useQuery({
    queryKey: ["members", "all"],
    queryFn: () => searchMembers(),
    enabled: open,
  })

  const keyIsValid = KEY_PATTERN.test(key)
  const canSubmit = name.trim().length > 0 && keyIsValid

  const mutation = useMutation({
    mutationFn: () =>
      createProject({
        name: name.trim(),
        key,
        type,
        leadMemberId: leadMemberId === SELF_LEAD ? null : leadMemberId,
      }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
      toast.success(`Project ${project.key} created`)
      resetAndClose()
      navigate(`/projects/${project.id}`)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not create the project")),
  })

  function resetAndClose() {
    setOpen(false)
    setName("")
    setKey("")
    setType("SCRUM")
    setLeadMemberId(SELF_LEAD)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button size="sm">New project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a project</DialogTitle>
          <DialogDescription>
            A project holds issues under a unique key. You become its administrator.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) {
              mutation.mutate()
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tessera Improvements"
              maxLength={128}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-key">Key</Label>
            <Input
              id="project-key"
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              placeholder="TIC"
              maxLength={32}
            />
            <p className="text-xs text-muted-foreground">
              Uppercase letters and digits, starting with a letter — issues become {key || "TIC"}-1,{" "}
              {key || "TIC"}-2, …
            </p>
            {key.length > 0 && !keyIsValid && (
              <p className="text-xs text-destructive">Must be uppercase, starting with a letter.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as ProjectType)}>
              <SelectTrigger id="project-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} — {option.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-lead">Lead</Label>
            <Select value={leadMemberId} onValueChange={setLeadMemberId}>
              <SelectTrigger id="project-lead">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELF_LEAD}>Myself (default)</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {memberName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
import { ProjectIconPicker } from "@/components/projects/ProjectIconPicker"
import { createProject } from "@/api/projects"
import type { BoardScopeStrategy } from "@/api/sprints"
import { searchMembers } from "@/api/members"
import { apiErrorMessage } from "@/api/errors"
import { memberName } from "@/lib/memberDisplay"

const KEY_PATTERN = /^[A-Z][A-Z0-9]*$/
const SELF_LEAD = "__self__"

/**
 * The question is still asked in plain words; the answer is stored as the board's scope strategy and
 * nothing else (ADR-0015), so the label the project shows later is derived from this same field rather
 * than from a second one that could drift away from it. Switching later is a board setting, not a
 * migration — which is why neither option reads as permanent.
 */
const PLANNING_STYLES: Array<{ value: BoardScopeStrategy; label: string; hint: string }> = [
  { value: "ACTIVE_SPRINT", label: "Scrum", hint: "Plan in sprints, with a backlog and reports." },
  { value: "ALL_ISSUES", label: "Kanban", hint: "Continuous flow — the board shows everything." },
]

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [icon, setIcon] = useState("")
  const [boardScopeStrategy, setBoardScopeStrategy] = useState<BoardScopeStrategy>("ACTIVE_SPRINT")
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
        icon: icon.trim(),
        boardScopeStrategy,
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
    setIcon("")
    setBoardScopeStrategy("ACTIVE_SPRINT")
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

          {/* Offered at creation rather than only in settings: a project gets its face while somebody
              is still thinking about what it is, and afterwards nobody goes back for it. */}
          <ProjectIconPicker icon={icon} onChange={setIcon} inputId="project-icon" />

          <div className="space-y-1.5">
            <Label htmlFor="project-planning">Planning</Label>
            <Select
              value={boardScopeStrategy}
              onValueChange={(value) => setBoardScopeStrategy(value as BoardScopeStrategy)}
            >
              <SelectTrigger id="project-planning">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANNING_STYLES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} — {option.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">You can switch this later in board settings.</p>
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

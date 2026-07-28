import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/context/LanguageContext"
import type { SaveSprintRequest } from "@/api/sprints"

/**
 * Plan a sprint, or correct one that already exists — the same two fields either way, so one dialog.
 * Deliberately no dates: a future sprint is a named bucket, and its window is fixed when it is started.
 */
export function SprintFormDialog({
  open,
  onOpenChange,
  mode,
  suggestedName,
  initialName,
  initialGoal,
  isPending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "rename"
  /** Offered when creating, so naming the next sprint is one keystroke in the common case. */
  suggestedName?: string
  initialName?: string
  initialGoal?: string | null
  isPending: boolean
  onSubmit: (request: SaveSprintRequest) => void
}) {
  const { t } = useLanguage()
  const [name, setName] = useState("")
  const [goal, setGoal] = useState("")

  // Re-seed each time the dialog opens: it is reused for "plan a new one" and "correct that one".
  useEffect(() => {
    if (open) {
      setName(initialName ?? suggestedName ?? "")
      setGoal(initialGoal ?? "")
    }
  }, [open, initialName, initialGoal, suggestedName])

  const canSubmit = name.trim().length > 0 && !isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("sprint.create.title", "Plan a sprint") : t("sprint.rename.title", "Edit sprint")}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? t("sprint.create.description", "A planned sprint has no dates — they are set when you start it.")
              : t(
                  "sprint.rename.description",
                  "Renaming a sprint does not rewrite history that already mentions its old name.",
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sprint-name">{t("sprint.field.name", "Name")}</Label>
            <Input id="sprint-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sprint-goal">{t("sprint.field.goal", "Goal")}</Label>
            <Textarea
              id="sprint-goal"
              rows={3}
              value={goal}
              placeholder={t("sprint.field.goalPlaceholder", "What is this sprint for?")}
              onChange={(event) => setGoal(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => onSubmit({ name: name.trim(), goal: goal.trim() || null })}
          >
            {mode === "create" ? t("sprint.create.submit", "Create sprint") : t("common.save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

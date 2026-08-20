import { useEffect, useState } from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@jmouse/ui"
import { useLanguage } from "@/context/LanguageContext"
import type { SprintSummary } from "@/api/sprints"

/**
 * Start a planned sprint. The end date is required and the submit stays disabled without one — the
 * server refuses a start with no end date (the burndown has no axis otherwise), and there is no reason
 * to make the member discover that through an error.
 *
 * There is no start date to fill in: the server stamps that at the moment the request lands.
 */
export function StartSprintDialog({
  sprint,
  open,
  onOpenChange,
  committedIssues,
  committedPoints,
  isPending,
  onStart,
}: {
  sprint: SprintSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  committedIssues: number
  committedPoints: number
  isPending: boolean
  onStart: (endDate: string) => void
}) {
  const { t } = useLanguage()
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    if (open) {
      setEndDate("")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sprint.start.title", "Start {sprint}", { sprint: sprint?.name ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("sprint.start.description", "Committing {issues} issues and {points} points.", {
              issues: committedIssues,
              points: committedPoints,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="sprint-end-date">{t("sprint.field.endDate", "End date")}</Label>
          <Input
            id="sprint-end-date"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button disabled={endDate.length === 0 || isPending} onClick={() => onStart(endDate)}>
            {t("sprint.start.submit", "Start sprint")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

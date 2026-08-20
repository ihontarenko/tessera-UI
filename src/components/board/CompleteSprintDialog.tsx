import { useEffect, useState } from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jmouse/ui"
import { useLanguage } from "@/context/LanguageContext"
import type { ActiveSprintView, CompleteSprintRequest, SprintSummary } from "@/api/sprints"

/** The backlog is a destination like any other, but it has no id — this stands in for one in the select. */
const BACKLOG = "__backlog__"

/**
 * Close the running sprint (Phase-3 ticket 05). Closing happens here, on the board, because that is
 * where the work is — and the dialog states how much is done and how much is not *before* asking
 * anything, so the decision is made against numbers rather than a memory of the standup.
 *
 * The destination for unfinished work is always sent explicitly: the server refuses to guess whether
 * four unfinished issues fall back to the backlog or roll into the next sprint. What the dialog does do
 * is *default* to the earliest future sprint when one is planned — which is the common case and one
 * click — and to the backlog when none is.
 *
 * It is one select rather than a radio pair plus a dependent dropdown, because "where does this go" is
 * one question and every answer to it is one row.
 */
export function CompleteSprintDialog({
  sprint,
  futureSprints,
  open,
  onOpenChange,
  isPending,
  onComplete,
}: {
  sprint: ActiveSprintView
  futureSprints: SprintSummary[]
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onComplete: (request: CompleteSprintRequest) => void
}) {
  const { t } = useLanguage()
  const earliestFutureSprint = futureSprints[0]
  const [destination, setDestination] = useState(BACKLOG)

  useEffect(() => {
    if (open) {
      setDestination(earliestFutureSprint?.id ?? BACKLOG)
    }
  }, [open, earliestFutureSprint])

  function complete() {
    onComplete(
      destination === BACKLOG
        ? { moveIncompleteTo: "BACKLOG" }
        : { moveIncompleteTo: "SPRINT", targetSprintId: destination },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sprint.complete.title", "Complete {sprint}", { sprint: sprint.name })}</DialogTitle>
          <DialogDescription>
            {t("sprint.complete.tally", "{completed} issues are done and {incomplete} are not.", {
              completed: sprint.completedIssues,
              incomplete: sprint.incompleteIssues,
            })}
          </DialogDescription>
        </DialogHeader>

        {sprint.incompleteIssues > 0 ? (
          <div className="space-y-1.5">
            <Label>
              {t("sprint.complete.destination", "Move {count} incomplete issues to…", {
                count: sprint.incompleteIssues,
              })}
            </Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BACKLOG}>{t("sprint.complete.toBacklog", "The backlog")}</SelectItem>
                {futureSprints.map((futureSprint) => (
                  <SelectItem key={futureSprint.id} value={futureSprint.id}>
                    {futureSprint.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("sprint.complete.allDone", "Everything committed to this sprint is done — nothing to move.")}
          </p>
        )}

        {/* Finished work is not going anywhere: it stays recorded against the sprint it was finished in,
            which is what the sprint report reads. Worth saying, because "complete" sounds like it might
            tidy something away. */}
        <p className="text-xs text-muted-foreground">
          {t(
            "sprint.complete.note",
            "Completed issues stay recorded against this sprint. A sprint cannot be reopened.",
          )}
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button disabled={isPending} onClick={complete}>
            {t("sprint.complete.submit", "Complete sprint")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

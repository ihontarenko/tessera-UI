import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusPill } from "@/components/issues/issueVisuals"
import { fetchCatalog, type IssueDetail } from "@/api/issues"

const CHOOSE = "__choose__"

/**
 * Where the issue is, and every legal way out of it (ticket 07).
 *
 * Moving work forward used to be a dropdown among the fields, indistinguishable from setting a
 * priority — and a dropdown hides its options until you open it, so the one thing people open an issue
 * to do took two clicks and a guess. The legal moves are buttons now, laid out flat: the current status
 * reads as a state, each move reads as an action, and what the workflow permits is visible without
 * asking.
 *
 * Only reachable statuses are shown, because that is all `availableTransitions` carries. Rendering the
 * whole workflow greyed out would need the issue to know its workflow's statuses, which is a backend
 * field this does not have.
 *
 * A transition that resolves the issue still prompts for a resolution first — the server refuses one
 * without it, and guessing on the caller's behalf would be inventing an answer (ADR-0004).
 */
export function IssueTransitionAction({
  issue,
  canTransition,
  isPending,
  onTransition,
}: {
  issue: IssueDetail
  canTransition: boolean
  isPending: boolean
  onTransition: (move: { toStatusId: string; resolutionId?: string | null }) => void
}) {
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null)
  const [resolutionId, setResolutionId] = useState(CHOOSE)
  const pendingTransition = issue.availableTransitions.find((option) => option.toStatusId === pendingStatusId)
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog, enabled: pendingTransition != null })

  function choose(toStatusId: string) {
    const option = issue.availableTransitions.find((entry) => entry.toStatusId === toStatusId)
    if (!option) {
      return
    }
    if (option.requiresResolution) {
      setResolutionId(CHOOSE)
      setPendingStatusId(toStatusId)
      return
    }
    onTransition({ toStatusId })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={issue.status} />
        {!issue.open && issue.resolution && <Badge variant="outline">{issue.resolution.name}</Badge>}
      </div>

      {canTransition && issue.availableTransitions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {issue.availableTransitions.map((option) => (
            <Button
              key={option.transitionId}
              size="sm"
              variant={option.toCategory === "DONE" ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              disabled={isPending}
              onClick={() => choose(option.toStatusId)}
            >
              <ArrowRight className="size-3" />
              {option.toStatusName}
            </Button>
          ))}
        </div>
      )}

      {pendingTransition && (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <Label className="text-xs">Resolution for “{pendingTransition.toStatusName}”</Label>
          <Select value={resolutionId} onValueChange={setResolutionId}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Choose a resolution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CHOOSE} disabled>
                Choose a resolution
              </SelectItem>
              {catalog?.resolutions.map((resolution) => (
                <SelectItem key={resolution.id} value={resolution.id}>
                  {resolution.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPendingStatusId(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={resolutionId === CHOOSE || isPending}
              onClick={() => {
                onTransition({ toStatusId: pendingTransition.toStatusId, resolutionId })
                setPendingStatusId(null)
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

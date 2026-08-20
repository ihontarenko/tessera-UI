import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ArrowRight, Ban } from "lucide-react"
import { Badge, Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jmouse/ui"
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
    // `space-y-3`, the rail's own rhythm — this block used to sit at `space-y-2` and read tighter than
    // everything stacked around it, which made the state and the moves look like one crowded thing
    // rather than a state followed by what can be done to it.
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={issue.status} />
        {!issue.open && issue.resolution && <Badge variant="outline">{issue.resolution.name}</Badge>}
      </div>

      {/* ⚠️ Above the moves, not beside them, because it explains an absence (TSSR-41). The blocked
          transitions are not in `availableTransitions` at all — so without this the buttons a person
          expected are simply missing, and a missing control with no reason reads as a broken screen. */}
      {issue.blockedBy.length > 0 && (
        <p className="flex flex-wrap items-baseline gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs">
          <Ban className="size-3 shrink-0 self-center text-warning" />
          <span className="text-muted-foreground">Blocked by</span>
          {issue.blockedBy.map((issueKey) => (
            <Link key={issueKey} to={`/issues/${issueKey}`} className="font-mono font-medium hover:underline">
              {issueKey}
            </Link>
          ))}
        </p>
      )}

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
        // Two rhythms rather than one: 12px between the groups, 6px between a label and the control it
        // names. A single `space-y-2` throughout put the same gap in both places, which left the label
        // floating between the heading above it and the field below rather than belonging to either —
        // and it disagreed with the board's copy of this prompt, which has always used `space-y-1.5`.
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <div className="space-y-1.5">
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
          </div>
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

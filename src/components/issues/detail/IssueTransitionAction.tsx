import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusPill } from "@/components/issues/issueVisuals"
import { fetchCatalog, type IssueDetail } from "@/api/issues"

const CHOOSE = "__choose__"

/**
 * Where the issue is, and the one action that moves it (ticket 07).
 *
 * Moving work forward used to be a dropdown among the fields, indistinguishable from setting a
 * priority. It is the thing people open an issue to do, so it is the primary action at the top of the
 * rail. What it offers is still whatever the workflow engine says is legal from here — this control
 * decides nothing, it only asks.
 *
 * A transition that resolves the issue still prompts for a resolution first, because the server refuses
 * one without it and guessing on the caller's behalf would be inventing an answer (ADR-0004).
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="w-full justify-between" disabled={isPending}>
              Move this issue
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {issue.availableTransitions.map((option) => (
              <DropdownMenuItem key={option.transitionId} onSelect={() => choose(option.toStatusId)}>
                {option.name} → {option.toStatusName}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jmouse/ui"
import { LinkTargetPicker } from "@/components/issues/registers/LinkTargetPicker"
import { useRegisterLinking } from "@/components/issues/registers/useRegisterLinking"
import { fetchLinkTypes, type IssueDetail } from "@/api/issues"

/**
 * Linking, given room (TSSR-73).
 *
 * <h2>Why this is a dialog and not three controls in the rail</h2>
 *
 * It was a select, a text input and a second select stacked in a 290px column: every one of them
 * truncated, and the search reset itself on every link made. That is a shape that works for linking one
 * issue and punishes linking three.
 *
 * ⚠️ **The type is chosen once, the targets as many times as it takes.** `LinkTargetPicker` already
 * gathers a selection across projects and `useRegisterLinking.linkAll` already writes them one at a time,
 * stopping at the first refusal and reporting how many landed — the domain refuses a duplicate link and
 * one that would close a blocking cycle, and both answers are about the register *as it stands*, so
 * firing them in parallel would have them all decided against the same stale state. Reusing that pair is
 * the whole implementation; the Registers tab solved this and there is no second way it should behave.
 *
 * ⚠️ **The dialog closes only when the batch lands whole.** A partial failure leaves it open with the
 * selection intact, which is what somebody needs in order to see what was left and try again.
 *
 * ⚠️ `grid-cols-[minmax(0,1fr)]` — `DialogContent` is a grid, and a grid item's automatic minimum size
 * is its min-content width, so without it a long summary in the results pushes the dialog past its own
 * border (TSSR-75).
 */
export function IssueLinkDialog({
  issue,
  open,
  onOpenChange,
}: {
  issue: IssueDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [chosenLinkTypeId, setChosenLinkTypeId] = useState("")
  const { data: linkTypes = [] } = useQuery({ queryKey: ["link-types"], queryFn: fetchLinkTypes })
  const { linkAll } = useRegisterLinking()

  // ⚠️ Derived rather than stored through an effect: the first type is the value until somebody picks
  // another, so the control is never empty and `onLink` can never fire without one.
  const linkTypeId = chosenLinkTypeId || linkTypes[0]?.id || ""
  const linkedIssueKeys = issue.links.map((link) => link.issue.issueKey)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] max-h-[88vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader className="pr-8">
          <DialogTitle>Link an issue</DialogTitle>
          <DialogDescription>
            Say how {issue.issueKey} relates to them, then pick as many as you like — from any project you
            belong to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs">Relationship</Label>
          {/* The outward label is the sentence being written: "this issue <blocks> the ones below". The
              inward wording is the same link read from the other end and would be a different claim. */}
          <Select value={linkTypeId} onValueChange={setChosenLinkTypeId}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Relationship…" />
            </SelectTrigger>
            <SelectContent>
              {linkTypes.map((linkType) => (
                <SelectItem key={linkType.id} value={linkType.id}>
                  {linkType.outwardLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <LinkTargetPicker
          hubIssueId={issue.id}
          linkedIssueKeys={linkedIssueKeys}
          isPending={linkAll.isPending || linkTypeId === ""}
          onLink={(targetIssueIds) =>
            linkAll.mutate(
              { hubIssueId: issue.id, linkTypeId, targetIssueIds },
              { onSuccess: () => onOpenChange(false) },
            )
          }
        />
      </DialogContent>
    </Dialog>
  )
}

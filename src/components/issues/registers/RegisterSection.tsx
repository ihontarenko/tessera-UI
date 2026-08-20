import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@jmouse/ui"
import { InlineSelect } from "@/components/inline/InlineSelect"
import { IssueGroup } from "@/components/issues/grouping/IssueGroup"
import { IssueListRow } from "@/components/issues/rows/IssueListRow"
import { LinkTargetPicker } from "@/components/issues/registers/LinkTargetPicker"
import { useRegisterLinking } from "@/components/issues/registers/useRegisterLinking"
import type { IssueRegisterItem, LinkType } from "@/api/issues"

/**
 * One register: the issue that gathers, and a plain list of what it gathers.
 *
 * ⚠️ **It was a card wrapping a table and is now a heading wrapping a list** — see {@link IssueGroup} for
 * why. What this file still owns is the *management*: retyping a link in place, unlinking, and gathering
 * more issues in one gesture. That is the whole reason the Registers tab exists rather than the rail being
 * enough (TSSR-45).
 */
export function RegisterSection({
  register,
  linkTypes,
  inward = false,
  canEdit,
}: {
  register: IssueRegisterItem
  linkTypes: LinkType[]
  /**
   * Which end the heading issue is on, so the type control reads the way the rows do.
   *
   * ⚠️ Labelling an inward row with the outward word states the relationship backwards — "tracks" on a row
   * that is tracking *this* issue. The label travels from the server per entry; this is what the *select's*
   * options are drawn from.
   */
  inward?: boolean
  /** `issue:edit` in the **heading issue's** project — the end every write here is recorded on. */
  canEdit: boolean
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [chosenLinkTypeId, setChosenLinkTypeId] = useState<string | null>(null)
  const { linkAll, changeType, unlink } = useRegisterLinking()

  const hub = register.issue
  const isPending = changeType.isPending || unlink.isPending
  const addLinkTypeId = chosenLinkTypeId ?? defaultAddLinkTypeOf(register, linkTypes)

  return (
    <IssueGroup
      issueKey={hub.issueKey}
      summary={hub.summary}
      type={hub.type}
      status={hub.status}
      open={hub.open}
      projectKey={register.project?.key}
      done={register.done}
      total={register.entries.length}
      footer={
        // ⚠️ **No gathering while reading the inward side.** A link added here is recorded *on* the heading
        // issue and therefore points away from it — so it would land on the other list and vanish from the
        // one being read, which looks like the button failed. Adding an inward link means acting on the other
        // issue, which is that issue's own screen.
        canEdit &&
        !inward && (
          <div className="mt-1 space-y-1.5">
            {!isAdding && (
              <Button size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={() => setIsAdding(true)}>
                <Plus className="mr-1 size-3.5" /> Gather more issues
              </Button>
            )}

            {isAdding && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Link as
                  </span>
                  <LinkTypeSelect
                    value={addLinkTypeId}
                    linkTypes={linkTypes}
                    inward={inward}
                    onChange={setChosenLinkTypeId}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 text-xs"
                    onClick={() => setIsAdding(false)}
                  >
                    Done
                  </Button>
                </div>
                <LinkTargetPicker
                  hubIssueId={hub.id}
                  linkedIssueKeys={register.entries.map((entry) => entry.issue.issueKey)}
                  isPending={linkAll.isPending}
                  onLink={(targetIssueIds) =>
                    linkAll.mutate(
                      { hubIssueId: hub.id, linkTypeId: addLinkTypeId, targetIssueIds },
                      // Closing the picker is what clears the selection — and it only closes when the batch
                      // landed whole. A refusal leaves it open with the checkboxes intact to try again.
                      { onSuccess: () => setIsAdding(false) },
                    )
                  }
                />
              </>
            )}
          </div>
        )
      }
    >
      {register.entries.map((entry) => (
        <IssueListRow
          key={entry.linkId}
          issueKey={entry.issue.issueKey}
          summary={entry.issue.summary}
          type={entry.issue.type}
          status={entry.issue.status}
          open={entry.issue.open}
          projectKey={entry.projectKey}
          readable={entry.issue.readable}
          trailing={
            <span className="flex shrink-0 items-center gap-1">
              {/* The label is the control (TSSR-40): retyping in place rather than deleting and recreating.
                  The options read the side being shown, so an inward row says "tracked by" rather than
                  claiming this issue tracks the one gathering it. */}
              {canEdit ? (
                <LinkTypeSelect
                  value={entry.linkTypeId}
                  linkTypes={linkTypes}
                  inward={inward}
                  disabled={isPending}
                  onChange={(linkTypeId) =>
                    changeType.mutate({ hubIssueId: hub.id, linkId: entry.linkId, linkTypeId })
                  }
                />
              ) : (
                <span className="text-xs text-muted-foreground">{entry.label}</span>
              )}

              {canEdit && (
                <button
                  type="button"
                  // Quiet until the row is under the pointer: an × on every row of a twenty-item register
                  // reads as a list of delete buttons.
                  // ⚠️ Faint, never invisible. `opacity-0` is the defect the comment controls were rewritten
                  // out of in this same change: a hover-only control does not exist on a touch screen.
                  className="text-muted-foreground opacity-50 transition-opacity hover:text-destructive-ink focus:opacity-100 group-hover/row:opacity-100"
                  onClick={() => unlink.mutate({ hubIssueId: hub.id, linkId: entry.linkId })}
                  disabled={isPending}
                  aria-label={`Remove the link to ${entry.issue.issueKey}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </span>
          }
        />
      ))}
    </IssueGroup>
  )
}

function LinkTypeSelect({
  value,
  linkTypes,
  inward,
  onChange,
  disabled = false,
}: {
  value: string
  linkTypes: LinkType[]
  /** Reads the label for the side being shown — see the prop's note on {@link RegisterSection}. */
  inward: boolean
  onChange: (linkTypeId: string) => void
  disabled?: boolean
}) {
  return (
    <InlineSelect
      ariaLabel="Link type"
      className="w-28 text-xs text-muted-foreground"
      value={value}
      disabled={disabled}
      options={linkTypes.map((linkType) => ({
        value: linkType.id,
        label: inward ? linkType.inwardLabel : linkType.outwardLabel,
      }))}
      onChange={onChange}
    />
  )
}

/**
 * Which type new links get, until somebody says otherwise.
 *
 * ⚠️ **The register's own predominant type, not a constant.** A hub built out of `Tracks` links keeps
 * gathering with `Tracks`, and one built out of `Relates` does not silently switch — and neither answer can
 * come from a hardcoded name, because a link type is a row somebody may rename (TSSR-40). An empty register
 * falls back to the first type the installation offers rather than to a name this code believes in.
 */
function defaultAddLinkTypeOf(register: IssueRegisterItem, linkTypes: LinkType[]) {
  return register.entries[0]?.linkTypeId ?? linkTypes[0]?.id ?? ""
}

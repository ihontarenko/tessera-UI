import { ArrowDown, ArrowUp, Plus, Star, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IssueTypeIcon } from "@/components/issues/issueVisuals"
import type { IssueTypeResponse } from "@/api/configurationAdministration"

interface SchemeMembershipEditorProperties {
  allIssueTypes: IssueTypeResponse[]
  selectedIds: string[]
  defaultId: string
  onChange: (selectedIds: string[], defaultId: string) => void
  /** Rendered under a member that is about to be dropped — the count of work it already holds. */
  renderRemovalImpact?: (issueTypeId: string) => React.ReactNode
}

/**
 * Membership, order and default in one control, because they are one decision.
 *
 * ⚠️ **The default is chosen here rather than in a separate select**, and that is the whole reason this
 * control exists. A scheme's default must be one of its own members; a separate picker can offer a type
 * the scheme does not grant, and then either the save is refused for a reason the form never mentioned
 * or the scheme ends up preselecting something nobody can raise. Here the star is only offerable on a
 * row that is already in.
 *
 * ⚠️ **Removing the default is prevented rather than refused**, for the same reason. The star moves to
 * the next member automatically — a scheme with no default is not a state the model has, so it is not a
 * state the form can produce.
 */
export function SchemeMembershipEditor({
  allIssueTypes,
  selectedIds,
  defaultId,
  onChange,
  renderRemovalImpact,
}: SchemeMembershipEditorProperties) {
  const byId = new Map(allIssueTypes.map((issueType) => [issueType.id, issueType]))
  const available = allIssueTypes.filter((issueType) => !selectedIds.includes(issueType.id))

  function add(issueTypeId: string) {
    const next = [...selectedIds, issueTypeId]
    onChange(next, defaultId || issueTypeId)
  }

  function remove(issueTypeId: string) {
    const next = selectedIds.filter((held) => held !== issueTypeId)
    // The star follows the membership: dropping the default hands it to whatever is left, and dropping
    // the last member leaves nothing to preselect until one is added back.
    onChange(next, issueTypeId === defaultId ? (next[0] ?? "") : defaultId)
  }

  function move(index: number, by: number) {
    const target = index + by

    if (target < 0 || target >= selectedIds.length) {
      return
    }

    const next = [...selectedIds]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next, defaultId)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          In this scheme — the order pickers offer them in
        </p>

        {selectedIds.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            A scheme with no types is a project nothing can be raised in. Add at least one.
          </p>
        )}

        <ul className="space-y-1">
          {selectedIds.map((issueTypeId, index) => {
            const issueType = byId.get(issueTypeId)

            return (
              <li key={issueTypeId} className="rounded-md border px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <IssueTypeIcon type={issueType ?? null} className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{issueType?.name ?? issueTypeId}</span>

                  {issueTypeId === defaultId && (
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      Preselected
                    </Badge>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Preselect ${issueType?.name ?? issueTypeId}`}
                    aria-pressed={issueTypeId === defaultId}
                    onClick={() => onChange(selectedIds, issueTypeId)}
                  >
                    <Star className={issueTypeId === defaultId ? "size-4 fill-current" : "size-4"} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Move down"
                    disabled={index === selectedIds.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${issueType?.name ?? issueTypeId}`}
                    onClick={() => remove(issueTypeId)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                {renderRemovalImpact?.(issueTypeId)}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Not in it</p>

        {available.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Every issue type the installation has is in this scheme.
          </p>
        ) : (
          <ul className="space-y-1">
            {available.map((issueType) => (
              <li key={issueType.id}>
                <button
                  type="button"
                  onClick={() => add(issueType.id)}
                  className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <IssueTypeIcon type={issueType} className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{issueType.name}</span>
                  <Plus className="size-4 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

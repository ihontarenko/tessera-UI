import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SearchInput } from "@/components/SearchInput"
import { IssueTypeIcon, StatusPill } from "@/components/issues/issueVisuals"
import { searchIssues } from "@/api/issues"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

const RESULT_LIMIT = 20

/**
 * Finding issues and linking a handful of them in one gesture.
 *
 * ⚠️ **This is the half the rail cannot do, and the reason the Tracked tab exists** (TSSR-45). The rail's
 * picker is one select and one button: twenty tickets across four projects means twenty rounds of
 * search-choose-click-wait, and the search resets each time. Here the search stays put and the results
 * carry checkboxes, so gathering an effort is one search and one click.
 *
 * ⚠️ **What is already in the register is not offered.** The domain refuses a duplicate link with a
 * perfectly clear message, and a picker that offers a choice it knows will be refused is a picker that
 * makes the reader test it. Same for the hub itself — an issue cannot gather itself.
 */
export function LinkTargetPicker({
  hubIssueId,
  linkedIssueKeys,
  isPending,
  onLink,
}: {
  hubIssueId: string
  /** The keys already gathered — filtered out rather than offered and then refused. */
  linkedIssueKeys: string[]
  isPending: boolean
  /**
   * ⚠️ Called with the selection, which this component keeps. Clear it by unmounting the picker (the caller
   * closes it on success); a picker that cleared its own selection on click loses what a partial failure
   * left behind.
   */
  onLink: (targetIssueIds: string[]) => void
}) {
  const [text, setText] = useState("")
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([])
  const debouncedText = useDebouncedValue(text, 250)

  const { data: results } = useQuery({
    queryKey: ["issue-search", "link-candidates", debouncedText],
    queryFn: () => searchIssues({ text: debouncedText.trim() || undefined, size: RESULT_LIMIT }),
  })

  const alreadyLinked = new Set(linkedIssueKeys)
  const candidates = (results?.items ?? []).filter(
    (row) => row.issue.id !== hubIssueId && !alreadyLinked.has(row.issue.issueKey),
  )

  function toggle(issueId: string) {
    setSelectedIssueIds((selected) =>
      selected.includes(issueId) ? selected.filter((entry) => entry !== issueId) : [...selected, issueId],
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <SearchInput
        value={text}
        onChange={setText}
        placeholder="Find issues to gather, any project…"
        className="w-full"
      />

      {candidates.length === 0 && (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          {debouncedText.trim().length === 0
            ? "Type to search every project you belong to."
            : "Nothing matches, or everything that does is already here."}
        </p>
      )}

      {/* ⚠️ The height belongs on the viewport, not on the root — `max-h-*` on a Radix ScrollArea root
          clips its content instead of scrolling it. */}
      {candidates.length > 0 && (
        <ScrollArea className="w-full">
          <ul className="max-h-56 space-y-0.5 pr-2">
            {candidates.map((row) => (
              <li key={row.issue.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/60">
                  {/* Frozen while the batch is in flight: the list it is describing is being changed. */}
                  <input
                    type="checkbox"
                    className="size-3.5 shrink-0 accent-current"
                    checked={selectedIssueIds.includes(row.issue.id)}
                    disabled={isPending}
                    onChange={() => toggle(row.issue.id)}
                  />
                  <IssueTypeIcon type={row.issue.type} />
                  <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                    {row.project.key}
                  </Badge>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{row.issue.issueKey}</span>
                  <span className="min-w-0 flex-1 truncate">{row.issue.summary}</span>
                  <StatusPill status={row.issue.status} />
                </label>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      {/* ⚠️ **The selection is NOT cleared here.** It used to be, synchronously, right after firing — and the
          batch stops at the first refusal, so a partial failure wiped the very list somebody needed in order
          to see what was left and try again. It is the caller's job to clear it once the write has actually
          landed. */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 w-full text-xs"
        disabled={selectedIssueIds.length === 0 || isPending}
        onClick={() => onLink(selectedIssueIds)}
      >
        <Link2 className="mr-1 size-3.5" />
        {selectedIssueIds.length <= 1 ? "Link the selected issue" : `Link ${selectedIssueIds.length} issues`}
      </Button>
    </div>
  )
}

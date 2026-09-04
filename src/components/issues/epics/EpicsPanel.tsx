import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Layers } from "lucide-react"
import { Skeleton } from "@jmouse/ui"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { IssueGroup, ProgressMeter } from "@/components/issues/grouping/IssueGroup"
import { IssueListRow, IssueRowLayout } from "@/components/issues/rows/IssueListRow"
import { formatStoryPoints } from "@/components/issues/issueVisuals"
import { groupByEpic } from "@/components/issues/epics/epicGrouping"
import { listIssues, type IssueRow } from "@/api/issues"

/**
 * The project's work gathered under its epics.
 *
 * ⚠️ **The same shape as the Registers tab, from the other kind of grouping.** A register groups by *link*
 * across projects; this groups by *hierarchy* inside one. Both answer "these belong to that, and here is how
 * much is done", so both are {@link IssueGroup} — two markups would drift into two different-looking answers
 * to one question.
 *
 * ⚠️ **No filters here, on purpose.** The All tab's filters narrow a flat list, which is exactly what they
 * are for; applied to this one they would hide the epics themselves — an epic is typically Parked or To Do
 * while its children are in flight — and drop their children into "Not in an epic". A grouping whose
 * headings vanish under a status filter is worse than no filter.
 */
export function EpicsPanel({ projectId }: { projectId: string }) {
  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["issues", projectId],
    queryFn: () => listIssues(projectId),
  })

  const groups = useMemo(() => groupByEpic(issues), [issues])

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  // ⚠️ **Empty means the project is empty, not that it has no epics.** This tested `epicCount === 0`, so a
  // project with forty unfiled issues and no epic showed nothing at all — the exact "silently holds fewer
  // issues than the project has" failure `epicGrouping` was written to avoid, produced by the screen instead
  // of by the grouping. With no epics there is one group, *Not in an epic*, and it holds everything.
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Nothing to gather yet"
        message="Raise an issue of an epic type and give other issues it as their parent — they will gather here."
      />
    )
  }

  return (
    <div className="divide-y">
      {groups.map((group) =>
        group.epic ? (
          <IssueGroup
            key={group.epic.id}
            issueKey={group.epic.issueKey}
            summary={group.epic.summary}
            type={group.epic.type}
            status={group.epic.status}
            open={group.epic.open}
            caption={group.epic.type?.name}
            done={group.done}
            total={group.issues.length}
            // One project, so a project column would stand empty on every row.
            withProject={false}
          >
            {group.issues.length === 0 ? (
              <li className="px-1 py-1.5 text-xs text-muted-foreground">Nothing is filed under it yet.</li>
            ) : (
              group.issues.map((issue) => <EpicMemberRow key={issue.id} issue={issue} />)
            )}
          </IssueGroup>
        ) : (
          // ⚠️ Its own heading rather than an `IssueGroup` with an invented head: that component heads an
          // *issue*, and there is no issue here. Kept in the list at all because work nobody filed is the
          // thing this screen is most useful for finding.
          // ⚠️ A transparent accent edge rather than no edge: the 4px + padding is what keeps its rows
          // aligned with every other group's, and a coloured stripe would claim a type it has not got. And
          // the columns come from an explicit provider — see `IssueRowLayout`.
          <section
            key="__loose__"
            className="border-l-4 border-l-transparent py-3 pl-3 first:pt-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <h3 className="text-base font-semibold tracking-[-0.01em] text-muted-foreground">
                Not in an epic
              </h3>
              {group.issues.length > 0 && <ProgressMeter done={group.done} total={group.issues.length} />}
            </div>
            {/* The layout comes from an explicit provider: this group has no heading issue, so it cannot use
                `IssueGroup`, and rows that read a context default would misalign the day the default moved. */}
            <IssueRowLayout withProject={false} className="mt-2">
              {group.issues.map((issue) => (
                <EpicMemberRow key={issue.id} issue={issue} />
              ))}
            </IssueRowLayout>
          </section>
        ),
      )}
    </div>
  )
}

/** One issue under an epic — the assignee and the estimate, which is what planning reads a group for. */
function EpicMemberRow({ issue }: { issue: IssueRow }) {
  return (
    <IssueListRow
      issueKey={issue.issueKey}
      summary={issue.summary}
      type={issue.type}
      status={issue.status}
      open={issue.open}
      schedule={issue.schedule}
      trailing={
        <span className="flex shrink-0 items-center gap-2">
          {issue.storyPoints !== null && (
            <span className="text-xs tabular-nums text-muted-foreground">{formatStoryPoints(issue.storyPoints)}</span>
          )}
          {issue.assignee && <MemberChip member={issue.assignee} />}
        </span>
      }
    />
  )
}

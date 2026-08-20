import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PackageCheck } from "lucide-react"
import { Skeleton } from "@jmouse/ui"
import { EmptyState } from "@/components/EmptyState"
import { SegmentedControl } from "@/components/SegmentedControl"
import { IssueDetailModal } from "@/components/issues/IssueDetailModal"
import { ShippedGroupCard } from "@/components/shipped/ShippedGroupCard"
import { useLanguage } from "@/context/LanguageContext"
import { useIssueArchiving } from "@/hooks/useIssueArchiving"
import { getShipped, type ShippedGroup } from "@/api/shipped"
import { EDIT_ISSUE } from "@/api/permissions"

/**
 * Which half of the finished work is on screen (TSSR-4).
 *
 * ⚠️ **This is what "the archive" is** — a view of one screen, not a screen of its own. Archived work is
 * a state on the issue, and a second screen listing it would be the flat archive the ticket ruled out:
 * a list that only grows, with no answer to *when* anything shipped. Filtering keeps the grouping, the
 * counts and the restore control that make the list readable.
 */
type ShippedView = "all" | "active" | "archived"

/**
 * The Shipped tab (TSSR-4): what this project has delivered, newest first.
 *
 * **It is the archive, and it is deliberately not a list of archived issues.** A screen showing only
 * what has been put away answers a question nobody asks; this one answers *what did we deliver*, and
 * archiving is the control it offers on each row. Which is also why nothing here is hidden: everything
 * finished is listed, and the archived ones are marked rather than filtered out.
 *
 * The grouping — sprints or months — is the server's answer, not a decision retaken here (see
 * `api/shipped.ts`). Everything is derived on read, so a project that has just closed a sprint sees it
 * at the top with no job having run (ADR-0013).
 */
export function ShippedPanel({ projectId, permissions }: { projectId: string; permissions: string[] }) {
  const { t } = useLanguage()
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [view, setView] = useState<ShippedView>("all")
  const { archive, unarchive } = useIssueArchiving()

  const { data: shipped, isLoading } = useQuery({
    queryKey: ["shipped", projectId],
    queryFn: () => getShipped(projectId),
  })

  // Filtered here rather than re-fetched: the server already sent every finished issue with its
  // `archivedAt`, so a round trip per switch would buy nothing and make the control feel slower than
  // the answer it is showing.
  const groups = useMemo(() => filterGroups(shipped?.groups ?? [], view), [shipped, view])

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  if (!shipped || shipped.groups.length === 0) {
    return (
      <EmptyState
        icon={PackageCheck}
        title={t("shipped.empty.title", "Nothing has shipped yet")}
        message={t(
          "shipped.empty.message",
          "Issues appear here as they reach a Done status. Archive one to take it off the board without losing it.",
        )}
      />
    )
  }

  const canArchive = permissions.includes(EDIT_ISSUE)
  const isPending = archive.isPending || unarchive.isPending

  return (
    <div className="space-y-4">
      {/* One line saying what the screen is a view of — and how much of it is put away, which is the
          only number here a reader cannot get by counting the rows in front of them.

          Two phrasings rather than one with an "(s)": a project's first month of history says "1 group",
          and a screen that says "1 groups" reads as unfinished however correct everything behind it is. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {shipped.groups.length === 1
            ? t("shipped.summary.one", "1 group · {archived} archived", { archived: shipped.archivedIssues })
            : t("shipped.summary", "{groups} groups · {archived} archived", {
                groups: shipped.groups.length,
                archived: shipped.archivedIssues,
              })}
        </p>

        <SegmentedControl
          ariaLabel={t("shipped.view", "Which finished work to show")}
          segments={[
            { value: "all", label: t("shipped.view.all", "All") },
            { value: "active", label: t("shipped.view.active", "Not archived") },
            { value: "archived", label: t("shipped.view.archived", "Archived") },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {/* An empty answer to a filter is not an empty screen — the work is there, this slice of it is
          not, and saying so beats a blank space that reads as a failed load. */}
      {groups.length === 0 && (
        <p className="rounded-lg border bg-muted/20 px-3 py-8 text-center text-sm text-muted-foreground">
          {view === "archived"
            ? t("shipped.none.archived", "Nothing has been archived yet.")
            : t("shipped.none.active", "Everything finished here has been archived.")}
        </p>
      )}

      {groups.map((group) => (
        <ShippedGroupCard
          key={group.key}
          group={group}
          canArchive={canArchive}
          isPending={isPending}
          onSelectIssue={setSelectedIssueId}
          onArchive={(issueId) => archive.mutate(issueId)}
          onRestore={(issueId) => unarchive.mutate(issueId)}
        />
      ))}

      <IssueDetailModal
        issueId={selectedIssueId}
        projectId={projectId}
        permissions={permissions}
        open={selectedIssueId !== null}
        onOpenChange={(next) => {
          if (!next) {
            setSelectedIssueId(null)
          }
        }}
      />
    </div>
  )
}

/**
 * The groups as this view sees them: issues narrowed, counts and point totals recomputed from what
 * survived, and a group left with nothing dropped entirely.
 *
 * ⚠️ **Recomputing the totals is the point.** The server's `issueCount` describes the whole group, so
 * carrying it through a filter would print "8 issues" above a list of two — the kind of wrong number a
 * reader trusts precisely because everything around it is right.
 */
function filterGroups(groups: ShippedGroup[], view: ShippedView): ShippedGroup[] {
  if (view === "all") {
    return groups
  }

  return groups
    .map((group) => {
      const issues = group.issues.filter((issue) =>
        view === "archived" ? issue.archivedAt !== null : issue.archivedAt === null,
      )

      return {
        ...group,
        issues,
        issueCount: issues.length,
        storyPoints: issues.reduce((total, issue) => total + (issue.storyPoints ?? 0), 0),
      }
    })
    .filter((group) => group.issues.length > 0)
}

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BarChart3 } from "lucide-react"
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@jmouse/ui"
import { EmptyState } from "@/components/EmptyState"
import { IssueDetailModal } from "@/components/issues/IssueDetailModal"
import { BurndownChart } from "@/components/reports/BurndownChart"
import { SprintReportBucket } from "@/components/reports/SprintReportBucket"
import { VelocityChart } from "@/components/reports/VelocityChart"
import { useLanguage } from "@/context/LanguageContext"
import { formatPointTotal } from "@/lib/helpers"
import { getSprintReport, getVelocity } from "@/api/reports"
import { listSprints, type SprintSummary } from "@/api/sprints"

/**
 * The Reports tab (Phase-3 tickets 06 and 07): a sprint selector driving a burndown and a report on what
 * the sprint completed, did not complete and dropped, with the project's velocity underneath.
 * Everything is derived on read from data ordinary use already wrote — no snapshot table, no scheduled
 * job (ADR-0013).
 *
 * The selector drives the top half only. Velocity is about the run of sprints rather than any one of
 * them, so it hangs below and ignores the selection entirely.
 *
 * The selector offers every sprint that has actually run, newest first, so a bad sprint can be compared
 * against a good one rather than only the latest being visible. A sprint that never started is not
 * offered: it has no window, and the server refuses a report for one.
 *
 * The tab itself is shown by the board's scope strategy, never by the project's type (ADR-0012) — that
 * decision lives one level up, in the project page's tab list.
 */
export function ReportsPanel({ projectId, permissions }: { projectId: string; permissions: string[] }) {
  const { t } = useLanguage()
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => listSprints(projectId),
  })

  const reportableSprints = useMemo(() => toReportableSprints(sprints), [sprints])
  // Default to the most recent sprint that ran, and follow it if the list arrives or changes underneath.
  const sprintId = selectedSprintId ?? reportableSprints[0]?.id ?? null

  useEffect(() => {
    if (selectedSprintId && !reportableSprints.some((sprint) => sprint.id === selectedSprintId)) {
      setSelectedSprintId(null)
    }
  }, [reportableSprints, selectedSprintId])

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["sprint-report", projectId, sprintId],
    queryFn: () => getSprintReport(projectId, sprintId!),
    enabled: sprintId !== null,
  })

  if (sprintsLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  if (reportableSprints.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t("report.empty.title", "No sprint has run yet")}
        message={t("report.empty.message", "Start a sprint from the backlog and its report appears here.")}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="report-sprint">{t("report.sprint", "Sprint")}</Label>
          <Select value={sprintId ?? undefined} onValueChange={setSelectedSprintId}>
            <SelectTrigger id="report-sprint" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reportableSprints.map((sprint) => (
                <SelectItem key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {reportLoading || !report ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="space-y-4">
          {/* The headline is one line rather than arithmetic the reader has to do: committed against
              completed is the number a retrospective opens with. */}
          <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/20 px-4 py-3">
            <Headline
              label={t("report.committed", "Committed")}
              value={t("report.tally", "{issues} issues · {points} points", {
                issues: report.committedIssues,
                points: formatPointTotal(report.committedPoints),
              })}
            />
            <Headline
              label={t("report.completed", "Completed")}
              value={t("report.tally", "{issues} issues · {points} points", {
                issues: report.completedIssues,
                points: formatPointTotal(report.completedPoints),
              })}
            />
          </div>

          <section className="rounded-lg border bg-muted/20 p-3">
            <h3 className="mb-2 font-display text-sm font-semibold tracking-[-0.01em]">
              {t("report.burndown.title", "Burndown")}
            </h3>
            <BurndownChart burndown={report.burndown} />
          </section>

          <SprintReportBucket
            title={t("report.bucket.completed", "Completed issues")}
            emptyMessage={t("report.bucket.completed.empty", "Nothing was finished in this sprint.")}
            issues={report.completed}
            onSelectIssue={setSelectedIssueId}
          />
          <SprintReportBucket
            title={t("report.bucket.incomplete", "Issues not completed")}
            emptyMessage={t("report.bucket.incomplete.empty", "Everything committed was finished.")}
            issues={report.incomplete}
            onSelectIssue={setSelectedIssueId}
          />
          <SprintReportBucket
            title={t("report.bucket.removed", "Issues removed from the sprint")}
            emptyMessage={t("report.bucket.removed.empty", "Nothing was pulled out mid-sprint.")}
            issues={report.removed}
            onSelectIssue={setSelectedIssueId}
          />
        </div>
      )}

      <VelocitySection projectId={projectId} />

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
 * Velocity (ticket 07) sits below the burndown and the report and is **cross-sprint**: it deliberately
 * ignores the selector above it, because its whole subject is the run of sprints rather than one of
 * them. It therefore fetches on its own key and is never invalidated by changing the selection.
 *
 * A project that has closed no sprint yet gets an empty state rather than an axis with nothing on it —
 * a running sprint is excluded on purpose, so "no data yet" here is a real and common answer.
 */
function VelocitySection({ projectId }: { projectId: string }) {
  const { t } = useLanguage()
  const { data: velocity = [], isLoading } = useQuery({
    queryKey: ["velocity", projectId],
    queryFn: () => getVelocity(projectId),
  })

  return (
    <section className="rounded-lg border bg-muted/20 p-3">
      <h3 className="mb-2 font-display text-sm font-semibold tracking-[-0.01em]">
        {t("velocity.title", "Velocity")}
      </h3>

      {isLoading && <Skeleton className="h-72 w-full" />}

      {!isLoading && velocity.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("velocity.empty", "Velocity appears once a sprint has been completed.")}
        </p>
      )}

      {!isLoading && velocity.length > 0 && <VelocityChart velocity={velocity} />}
    </section>
  )
}

function Headline({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-sm font-semibold tabular-nums tracking-[-0.01em]">{value}</p>
    </div>
  )
}

/**
 * The sprints there is anything to report on — the ones that have run — most recent first. A `FUTURE`
 * sprint has no start, no end and no members' worth of history, so offering it would only ever produce a
 * refusal.
 *
 * Ordered by when each sprint actually started, not by when it was created, so "most recent" here means
 * what it means on the velocity chart below: sprints are often planned out of the order they end up
 * being run in, and the two lists disagreeing about which is newest would be a small, lasting puzzle.
 */
function toReportableSprints(sprints: SprintSummary[]): SprintSummary[] {
  return sprints
    .filter((sprint) => sprint.startedAt !== null)
    .sort((first, second) => (second.startedAt ?? "").localeCompare(first.startedAt ?? ""))
}

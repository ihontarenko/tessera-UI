import { MemberChip } from "@/components/MemberChip"
import { IssueTypeIcon, StatusPill, formatStoryPoints } from "@/components/issues/issueVisuals"
import { useLanguage } from "@/context/LanguageContext"
import { formatPointTotal } from "@/lib/helpers"
import type { SprintReportIssue } from "@/api/reports"

/**
 * One bucket of a sprint report — what completed, what did not, or what was pulled out mid-sprint. The
 * three are listed separately and never merged, because "we did not finish it" and "we decided not to do
 * it" are different answers and a retrospective that conflates them starts from the wrong facts.
 *
 * The points shown are the estimate frozen when the issue joined the sprint, not its estimate today
 * (ADR-0013) — this is a record of what was committed to.
 */
export function SprintReportBucket({
  title,
  emptyMessage,
  issues,
  onSelectIssue,
}: {
  title: string
  emptyMessage: string
  issues: SprintReportIssue[]
  onSelectIssue: (issueId: string) => void
}) {
  const { t } = useLanguage()
  const points = issues.reduce((total, issue) => total + (issue.storyPoints ?? 0), 0)

  return (
    <section className="rounded-lg border bg-muted/20">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
        <h3 className="font-display text-sm font-semibold tracking-[-0.01em]">{title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t("report.bucket.summary", "{issues} issues · {points} points", {
            issues: issues.length,
            points: formatPointTotal(points),
          })}
        </span>
      </header>

      <div className="flex flex-col gap-1 p-2">
        {issues.length === 0 ? (
          <p className="px-1 py-3 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 shadow-sm transition-colors hover:border-primary/40"
            >
              <IssueTypeIcon type={issue.type} />

              <button
                type="button"
                onClick={() => onSelectIssue(issue.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{issue.issueKey}</span>
                <span className="truncate text-sm">{issue.summary}</span>
              </button>

              <div className="flex shrink-0 items-center gap-2">
                <StatusPill status={issue.status} />
                {issue.assignee ? <MemberChip member={issue.assignee} className="[&_.text-sm]:hidden" /> : null}
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                  {formatStoryPoints(issue.storyPoints)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

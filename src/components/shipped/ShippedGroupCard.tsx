import { Archive, ArchiveRestore } from "lucide-react"
import { MemberChip } from "@/components/MemberChip"
import { Badge } from "@jmouse/ui"
import { formatStoryPoints } from "@/components/issues/issueVisuals"
import { IssueListRow, IssueRowLayout } from "@/components/issues/rows/IssueListRow"
import { useLanguage } from "@/context/LanguageContext"
import { formatPointTotal } from "@/lib/helpers"
import type { ShippedGroup } from "@/api/shipped"
import type { IssueRow } from "@/api/issues"

/**
 * One slice of finished work — a sprint, or a month — with its issues and its totals (TSSR-4).
 *
 * Deliberately shaped like `SprintReportBucket`: both answer "what is in this pile", and two lists of
 * finished issues that looked different would read as two different kinds of thing. The differences are
 * the ones that carry meaning — an archived row is dimmed and says so, and each row offers the one
 * action that applies to it.
 */
export function ShippedGroupCard({
  group,
  canArchive,
  isPending,
  onSelectIssue,
  onArchive,
  onRestore,
}: {
  group: ShippedGroup
  canArchive: boolean
  isPending: boolean
  onSelectIssue: (issueId: string) => void
  onArchive: (issueId: string) => void
  onRestore: (issueId: string) => void
}) {
  const { t } = useLanguage()

  return (
    <section className="rounded-lg border bg-muted/20">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
        <h3 className="font-display text-sm font-semibold tracking-[-0.01em]">{group.title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t("shipped.group.summary", "{issues} issues · {points} points", {
            issues: group.issueCount,
            points: formatPointTotal(group.storyPoints ?? 0),
          })}
        </span>
      </header>

      {/* ⚠️ The rows were bordered, shadowed cards of their own — a third way of drawing an issue, inside a
          card that already had a border. They are `IssueRow` now, like every other list (TSSR-53). */}
      <IssueRowLayout withProject={false} className="px-2 py-1">
        {group.issues.map((issue) => (
          <ShippedRow
            key={issue.id}
            issue={issue}
            canArchive={canArchive}
            isPending={isPending}
            onSelectIssue={onSelectIssue}
            onArchive={onArchive}
            onRestore={onRestore}
          />
        ))}
      </IssueRowLayout>
    </section>
  )
}

function ShippedRow({
  issue,
  canArchive,
  isPending,
  onSelectIssue,
  onArchive,
  onRestore,
}: {
  issue: IssueRow
  canArchive: boolean
  isPending: boolean
  onSelectIssue: (issueId: string) => void
  onArchive: (issueId: string) => void
  onRestore: (issueId: string) => void
}) {
  const { t } = useLanguage()
  const isArchived = issue.archivedAt !== null

  return (
    <IssueListRow
      issueKey={issue.issueKey}
      summary={issue.summary}
      type={issue.type}
      status={issue.status}
      // Everything here is finished by definition, so nothing on this screen is struck through.
      open
      dimmed={isArchived}
      onOpen={() => onSelectIssue(issue.id)}
      trailing={
        <>
          {/* The badge rather than a separate list: the reader is looking at what shipped, and whether a
              given item has been put away is one attribute of it, not a different subject. */}
          {isArchived && <Badge variant="secondary">{t("shipped.archived", "Archived")}</Badge>}

          {issue.assignee ? <MemberChip member={issue.assignee} className="[&_.text-sm]:hidden" /> : null}
          <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
            {formatStoryPoints(issue.storyPoints)}
          </span>

          {canArchive && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => (isArchived ? onRestore(issue.id) : onArchive(issue.id))}
              className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              title={isArchived ? t("shipped.restore", "Restore") : t("shipped.archive", "Archive")}
              aria-label={isArchived ? t("shipped.restore", "Restore") : t("shipped.archive", "Archive")}
            >
              {isArchived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
            </button>
          )}
        </>
      }
    />
  )
}

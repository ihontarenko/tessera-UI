import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { CircleDot, FolderKanban, Inbox, type LucideIcon } from "lucide-react"
import { Badge, Skeleton } from "@jmouse/ui"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { PageHeader } from "@/components/PageHeader"
import { ProjectStyleBadge } from "@/components/projects/ProjectStyleBadge"
import { IssueTypeIcon, PriorityBadge, StatusPill } from "@/components/issues/issueVisuals"
import { FlowChart } from "@/components/dashboard/FlowChart"
import { AgeingList } from "@/components/dashboard/AgeingList"
import { BlockedList } from "@/components/dashboard/BlockedList"
import { StatusBarChart } from "@/components/dashboard/StatusBarChart"
import { ProgressMeter } from "@/components/dashboard/ProgressMeter"
import { searchIssues, type IssueSearchItem } from "@/api/issues"
import { fetchDashboardSummary } from "@/api/dashboard"
import { listProjects } from "@/api/projects"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import { useLanguage } from "@/context/LanguageContext"

/** Enough to be a list rather than a report; the page it links to is where you go for all of them. */
const LIST_SIZE = 8

/** The window the charts look back over — a week, which is what "lately" means without a number. */
const WINDOW_DAYS = 7

/**
 * How many status bars the standing card draws before folding.
 *
 * ⚠️ **Deliberately larger than any status catalogue somebody would configure.** The card reports empty
 * statuses as zeros, and its rows are sorted by size — so a fold at the ordinary six would remove
 * exactly the zeros that were asked for. It is a runaway guard, not a layout decision.
 */
const STANDING_ROWS = 16

/**
 * The first screen after signing in, and until now the only one that lied: it advertised Projects,
 * Boards and Issues as "coming" long after all three shipped.
 *
 * It answers five questions a member actually opens a tracker with — what is on me, what has moved,
 * where does everything stand, what kind of week was it, and where do I work. The first, second and
 * last come from reads that already exist: the cross-project search (scoped to the caller by
 * construction — the projects they may browse and nothing else, ADR-0008) and the projects list.
 *
 * ⚠️ **The third needed an aggregate endpoint, and that reversed an earlier decision here.** This screen
 * was deliberately built without one, on the principle that a screen whose job is to point at other
 * screens should read what those screens read. Charts broke it: a week of daily counts drawn from the
 * search means fetching every issue raised that week to count it in the browser, and a meter per project
 * means fetching every issue in every project. `GET /api/dashboard/summary` counts where the rows are,
 * and is confined to the caller's browsable projects before anything is counted rather than after.
 */
export function DashboardPage() {
  const { t } = useLanguage()
  const { data: member } = useCurrentMember()

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  })

  const mineParameters = { assigneeMemberId: member?.id, openOnly: true, size: LIST_SIZE }
  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: ["issue-search", mineParameters],
    queryFn: () => searchIssues(mineParameters),
    enabled: member != null,
  })

  const recentParameters = { size: LIST_SIZE }
  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ["issue-search", recentParameters],
    queryFn: () => searchIssues(recentParameters),
  })

  // One more read only because a count of everything open is a different question from a page of it.
  const openParameters = { openOnly: true, size: 1 }
  const { data: openAcrossProjects } = useQuery({
    queryKey: ["issue-search", openParameters],
    queryFn: () => searchIssues(openParameters),
  })

  // ⚠️ The one aggregate read. This screen was built deliberately without one — it pointed at other
  // screens and read what they read — and charts are what changed that: a week of daily counts drawn
  // from the search would mean fetching every issue raised that week to count it here, and a meter per
  // project would mean fetching every issue in every project. Counting belongs where the rows are.
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard-summary", WINDOW_DAYS],
    queryFn: () => fetchDashboardSummary(WINDOW_DAYS),
  })

  const progressByProject = new Map((summary?.projects ?? []).map((row) => [row.projectId, row]))

  return (
    <>
      <PageHeader
        title={t("dashboard.title", "Dashboard")}
        description={
          member ? (
            <span className="flex items-center gap-1.5">
              {t("dashboard.greeting", "Signed in as")}
              <MemberChip member={member} className="[&_.size-7]:size-5" />
            </span>
          ) : (
            t("dashboard.subtitle", "Tessera — project & issue tracker")
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label={t("dashboard.stat.assigned", "Assigned to me")}
          value={mine?.total}
          hint={t("dashboard.stat.assignedHint", "open")}
          to="/issues"
        />
        <StatTile
          label={t("dashboard.stat.open", "Open across my projects")}
          value={openAcrossProjects?.total}
          hint={t("dashboard.stat.openHint", "unresolved")}
          to="/issues"
        />
        <StatTile
          label={t("dashboard.stat.projects", "Projects")}
          value={projects.length}
          hint={t("dashboard.stat.projectsHint", "you belong to")}
          to="/projects"
        />
      </div>

      {/* The charts sit above the lists on purpose: they answer "what kind of week was it" and "where
          does everything stand", which are questions you can only answer by looking, while the lists
          below answer "what next", which you answer by reading.

          ⚠️ Movement and standing are deliberately ADJACENT and deliberately identical in shape. They
          are the same picture of two different facts, and a week of furious movement that ends with the
          boards exactly as they started is precisely the case where reading one as the other is wrong. */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard
          title={t("dashboard.created.title", "Raised")}
          headline={summary?.createdToday}
          headlineHint={t("dashboard.created.today", "today")}
          aside={
            summary &&
            t("dashboard.created.window", "{count} in {days} days")
              .replace("{count}", String(summary.createdInWindow))
              .replace("{days}", String(summary.days))
          }
          isLoading={summaryLoading}
        >
          {summary && <FlowChart series={summary.flowPerDay} />}
        </ChartCard>

        <ChartCard
          title={t("dashboard.movement.title", "Moved into")}
          headline={summary?.resolvedInWindow}
          headlineHint={t("dashboard.movement.resolved", "resolved")}
          aside={
            summary &&
            t("dashboard.movement.window", "in the last {days} days").replace(
              "{days}",
              String(summary.days),
            )
          }
          isLoading={summaryLoading}
        >
          {summary && summary.movedInto.length > 0 && (
            <StatusBarChart
              rows={summary.movedInto}
              label={t("dashboard.movement.label", "Moved into")}
            />
          )}
          {summary && summary.movedInto.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("dashboard.movement.empty", "Nothing changed status this week.")}
            </p>
          )}
        </ChartCard>

        {/* ⚠️ No window on this one, and the aside says so by naming projects instead of days. A card
            that looked like its neighbour and quietly carried the same "in the last 7 days" would be
            read as a week's worth of standing, which is not a thing. */}
        <ChartCard
          title={t("dashboard.standing.title", "Right now")}
          headline={summary?.openTotal}
          headlineHint={t("dashboard.standing.open", "open")}
          aside={
            summary &&
            t("dashboard.standing.projects", "across {count} projects").replace(
              "{count}",
              String(summary.projects.length),
            )
          }
          isLoading={summaryLoading}
        >
          {summary && summary.standing.length > 0 && (
            <StatusBarChart
              rows={summary.standing}
              label={t("dashboard.standing.label", "Sitting in")}
              // ⚠️ Well past what a catalogue holds, because the empty statuses are the point here. The
              // rows are sorted by size, so folding at six would fold away precisely the zeros — and
              // "nothing is in review" is one of the more useful things this card can say.
              maxRows={STANDING_ROWS}
            />
          )}
          {summary && summary.standing.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("dashboard.standing.empty", "Every board is clear.")}
            </p>
          )}
        </ChartCard>
      </div>

      {/* What is stuck, and what cannot move at all. Both are ranked lists rather than plots because
          the answer somebody acts on is a list of issues — so the rows are links, which no chart mark
          can be. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("dashboard.ageing.title", "Sitting longest")}
          // ⚠️ Coalesced rather than left undefined: ChartCard reads undefined as "still loading" and
          // draws a skeleton, so an installation with nothing open would show one for ever.
          headline={summary ? (summary.ageing[0]?.days ?? 0) : undefined}
          headlineHint={t("dashboard.ageing.hint", "days, the oldest")}
          aside={
            summary &&
            t("dashboard.ageing.open", "{count} open").replace("{count}", String(summary.openTotal))
          }
          isLoading={summaryLoading}
        >
          {summary && <AgeingList ageing={summary.ageing} openTotal={summary.openTotal} />}
        </ChartCard>

        <ChartCard
          title={t("dashboard.blocked.title", "Blocked")}
          headline={summary?.blockedTotal}
          headlineHint={t("dashboard.blocked.hint", "cannot start")}
          aside={
            summary &&
            summary.blocked.length > 0 &&
            t("dashboard.blocked.longest", "longest {days} days").replace(
              "{days}",
              String(summary.blocked[0].days),
            )
          }
          isLoading={summaryLoading}
        >
          {summary && <BlockedList blocked={summary.blocked} blockedTotal={summary.blockedTotal} />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IssueList
          title={t("dashboard.mine.title", "On me")}
          emptyIcon={Inbox}
          emptyTitle={t("dashboard.mine.emptyTitle", "Nothing assigned")}
          emptyMessage={t("dashboard.mine.emptyMessage", "No open issue in your projects has your name on it.")}
          items={mine?.items}
          total={mine?.total}
          isLoading={mineLoading || member == null}
          showAssignee={false}
        />
        <IssueList
          title={t("dashboard.recent.title", "Recently updated")}
          emptyIcon={CircleDot}
          emptyTitle={t("dashboard.recent.emptyTitle", "Nothing yet")}
          emptyMessage={t("dashboard.recent.emptyMessage", "Issues appear here as they are worked on.")}
          items={recent?.items}
          total={recent?.total}
          isLoading={recentLoading}
          showAssignee
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          {t("dashboard.projects.title", "Your projects")}
        </h2>

        {projectsLoading && <Skeleton className="h-20 w-full" />}

        {!projectsLoading && projects.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title={t("dashboard.projects.emptyTitle", "No projects yet")}
            message={t("dashboard.projects.emptyMessage", "Create one, or ask to be added to an existing project.")}
          />
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="flex flex-col gap-2 rounded-lg border p-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{project.key}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
                <ProjectStyleBadge boardScopeStrategy={project.boardScopeStrategy} />
              </span>

              {/* ⚠️ The meter waits for its own read rather than rendering zeros. Three empty segments
                  and "no issues yet" is a statement about the project, and printing it while the
                  numbers are still in flight would be a lie the card tells for a second. */}
              {summaryLoading && <Skeleton className="h-1.5 w-full" />}
              {!summaryLoading && progressByProject.has(project.id) && (
                <ProgressMeter progress={progressByProject.get(project.id)!} />
              )}
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}

/**
 * A chart with a headline number over it.
 *
 * ⚠️ **The number is not decoration and it is not the chart's subject.** The chart answers "what shape
 * was the week", which no single number can; the headline answers "how much", which the chart makes you
 * count. Putting the one thing worth reading at a glance in ink, above the marks, is what stops the
 * chart from having to carry a value label on every bar.
 */
function ChartCard({
  title,
  headline,
  headlineHint,
  aside,
  isLoading,
  children,
}: {
  title: string
  headline: number | undefined
  headlineHint: string
  aside: string | false | undefined
  isLoading: boolean
  children: ReactNode
}) {
  return (
    <section className="space-y-2 rounded-lg border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{title}</h2>
        {aside && <span className="text-xs text-muted-foreground tabular-nums">{aside}</span>}
      </div>

      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl leading-none font-semibold tabular-nums">
          {headline ?? <Skeleton className="inline-block h-6 w-10 align-middle" />}
        </span>
        <span className="text-xs text-muted-foreground">{headlineHint}</span>
      </p>

      {isLoading ? <Skeleton className="h-40 w-full" /> : children}
    </section>
  )
}

/** A number worth glancing at, and the screen that explains it. */
function StatTile({
  label,
  value,
  hint,
  to,
}: {
  label: string
  value: number | undefined
  hint: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-0.5 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{label}</span>
      <span className="font-display text-2xl leading-none font-semibold tabular-nums">
        {value ?? <Skeleton className="inline-block h-6 w-10 align-middle" />}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Link>
  )
}

/**
 * A list of issues from anywhere, each naming its project — the same shape the cross-project search
 * page uses, at a length that fits a dashboard.
 */
function IssueList({
  title,
  emptyIcon,
  emptyTitle,
  emptyMessage,
  items,
  total,
  isLoading,
  showAssignee,
}: {
  title: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyMessage: string
  items: IssueSearchItem[] | undefined
  total: number | undefined
  isLoading: boolean
  showAssignee: boolean
}) {
  const { t } = useLanguage()

  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{title}</h2>
        {total != null && total > LIST_SIZE && (
          <Link to="/issues" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            {t("dashboard.seeAll", "all {total} →", { total })}
          </Link>
        )}
      </div>

      {isLoading && <Skeleton className="h-48 w-full" />}

      {!isLoading && items && items.length === 0 && (
        <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />
      )}

      {!isLoading && items && items.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {items.map(({ project, issue }) => (
            <li key={issue.id}>
              <Link
                to={`/issues/${issue.issueKey}`}
                className="flex items-center gap-2 p-2 transition-colors hover:bg-accent/40"
              >
                <IssueTypeIcon type={issue.type} />
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{issue.issueKey}</span>
                <span className={`min-w-0 flex-1 truncate text-sm ${issue.open ? "" : "text-muted-foreground line-through"}`}>
                  {issue.summary}
                </span>
                <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                  {project.key}
                </Badge>
                <span className="hidden shrink-0 lg:inline-flex">
                  <PriorityBadge priority={issue.priority} />
                </span>
                <StatusPill status={issue.status} />
                {showAssignee && issue.assignee && (
                  <span className="hidden shrink-0 xl:inline-flex">
                    <MemberChip member={issue.assignee} className="[&_.size-7]:size-5 [&_div.truncate]:hidden" />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

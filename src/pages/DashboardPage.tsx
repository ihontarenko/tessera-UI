import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { CircleDot, FolderKanban, Inbox, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { PageHeader } from "@/components/PageHeader"
import { ProjectStyleBadge } from "@/components/projects/ProjectStyleBadge"
import { IssueTypeIcon, PriorityBadge, StatusPill } from "@/components/issues/issueVisuals"
import { searchIssues, type IssueSearchItem } from "@/api/issues"
import { listProjects } from "@/api/projects"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import { useLanguage } from "@/context/LanguageContext"

/** Enough to be a list rather than a report; the page it links to is where you go for all of them. */
const LIST_SIZE = 8

/**
 * The first screen after signing in, and until now the only one that lied: it advertised Projects,
 * Boards and Issues as "coming" long after all three shipped.
 *
 * It answers three questions a member actually opens a tracker with — what is on me, what has moved,
 * and where do I work — and it answers them from reads that already exist. The cross-project search
 * carries the first two (it is scoped to the caller by construction: the projects they may browse, and
 * nothing else — ADR-0008), and the projects list carries the third. No aggregate endpoint was
 * invented for a screen whose job is to point at other screens.
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
              className="flex items-center gap-2 rounded-lg border p-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="font-mono text-xs text-muted-foreground">{project.key}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
              <ProjectStyleBadge boardScopeStrategy={project.boardScopeStrategy} />
            </Link>
          ))}
        </div>
      </section>
    </>
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

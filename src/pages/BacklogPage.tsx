import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ListTodo } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MemberChip } from "@/components/MemberChip"
import { ProjectStyleBadge } from "@/components/projects/ProjectStyleBadge"
import { plansInSprints } from "@/lib/projectStyle"
import { listProjects } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"

/**
 * Backlog index (Phase-3 ticket 02), mirroring the boards index: the member's projects, opening each
 * one's Backlog tab. Only projects whose board plans in sprints are listed — the filter is the board's
 * scope strategy, never the project's type (ADR-0012).
 */
export function BacklogPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects })

  const planningProjects = (projects ?? []).filter((project) => plansInSprints(project.boardScopeStrategy))

  return (
    <>
      <PageHeader
        title={t("backlog.title", "Backlog")}
        description={t("backlog.subtitle", "Open a project's backlog")}
      />

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!isLoading && planningProjects.length === 0 && (
        <EmptyState
          icon={ListTodo}
          title={t("backlog.index.empty.title", "No sprint planning yet")}
          message={t(
            "backlog.index.empty.message",
            "A project appears here once its board is set to show the active sprint.",
          )}
        />
      )}

      {!isLoading && planningProjects.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">{t("common.key", "Key")}</TableHead>
              <TableHead>{t("common.project", "Project")}</TableHead>
              <TableHead className="w-28">{t("project.column.planning", "Planning")}</TableHead>
              <TableHead>{t("common.lead", "Lead")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planningProjects.map((project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}?tab=backlog`)}
              >
                <TableCell className="font-mono text-xs font-medium">{project.key}</TableCell>
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell>
                  <ProjectStyleBadge boardScopeStrategy={project.boardScopeStrategy} />
                </TableCell>
                <TableCell>
                  <MemberChip member={project.lead} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}

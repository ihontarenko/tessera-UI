import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ListTodo } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MemberChip } from "@/components/MemberChip"
import { ProjectStyleBadge } from "@/components/projects/ProjectStyleBadge"
import { listProjects } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"

/**
 * Backlog index (Phase-3 ticket 02), mirroring the boards index: the member's projects, opening each
 * one's Backlog tab. Every project is listed, because every project has a backlog (ADR-0016) — the
 * scope-strategy filter that used to sit here would now hide screens that exist.
 */
export function BacklogPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects })

  const backlogProjects = projects ?? []

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

      {!isLoading && backlogProjects.length === 0 && (
        <EmptyState
          icon={ListTodo}
          title={t("backlog.index.empty.title", "No projects yet")}
          message={t("backlog.index.empty.message", "Create a project and its backlog appears here.")}
        />
      )}

      {!isLoading && backlogProjects.length > 0 && (
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
            {backlogProjects.map((project) => (
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

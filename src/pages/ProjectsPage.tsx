import { useQuery } from "@tanstack/react-query"
import { projectPath } from "@/lib/projectReference"
import { useNavigate } from "react-router-dom"
import { FolderKanban } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/EmptyState"
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@jmouse/ui"
import { MemberChip } from "@/components/MemberChip"
import { ProjectIcon } from "@/components/projects/ProjectIcon"
import { ProjectStyleBadge } from "@/components/projects/ProjectStyleBadge"
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog"
import { listProjects } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"

export function ProjectsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects })

  return (
    <>
      <PageHeader
        title={t("projects.title", "Projects")}
        description={t("projects.subtitle", "Projects you belong to")}
        actions={<CreateProjectDialog />}
      />

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!isLoading && projects && projects.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title={t("projects.empty.title", "No projects yet")}
          message={t(
            "projects.empty.message",
            "Create your first project to start tracking work. You'll become its administrator.",
          )}
        />
      )}

      {!isLoading && projects && projects.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Key</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-28">Planning</TableHead>
              <TableHead>Lead</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={() => navigate(projectPath(project))}
              >
                <TableCell className="font-mono text-xs font-medium">
                  <span className="flex items-center gap-2">
                    <span className="flex w-4 shrink-0 justify-center">
                      <ProjectIcon icon={project.icon} size="sm" />
                    </span>
                    {project.key}
                  </span>
                </TableCell>
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

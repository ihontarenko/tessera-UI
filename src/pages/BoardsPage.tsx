import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Columns3 } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MemberChip } from "@/components/MemberChip"
import { ProjectStyleBadge } from "@/components/projects/ProjectStyleBadge"
import { listProjects } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"

/**
 * Board index (Phase-2 ticket 01). Every project has exactly one board, so this lists the projects the
 * member belongs to and opens each project's board tab. Replaces the sidebar's "soon" Boards
 * placeholder.
 */
export function BoardsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects })

  return (
    <>
      <PageHeader
        title={t("boards.title", "Boards")}
        description={t("boards.subtitle", "Open a project's board")}
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
          icon={Columns3}
          title={t("boards.empty.title", "No boards yet")}
          message={t("boards.empty.message", "Create a project and its board appears here automatically.")}
        />
      )}

      {!isLoading && projects && projects.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Key</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="w-28">Planning</TableHead>
              <TableHead>Lead</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}?tab=board`)}
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

import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MemberChip } from "@/components/MemberChip"
import { ProjectTypeBadge } from "@/components/projects/ProjectTypeBadge"
import { ProjectSettingsForm } from "@/components/projects/ProjectSettingsForm"
import { ProjectAccessPanel } from "@/components/projects/ProjectAccessPanel"
import { ProjectComponentsPanel } from "@/components/projects/ProjectComponentsPanel"
import { ProjectVersionsPanel } from "@/components/projects/ProjectVersionsPanel"
import { IssuesPanel } from "@/components/issues/IssuesPanel"
import { BoardPanel } from "@/components/board/BoardPanel"
import { BacklogPanel } from "@/components/backlog/BacklogPanel"
import { ADMINISTER_PROJECT, getProject } from "@/api/projects"

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  )
}

export function ProjectDetailPage() {
  const { projectId = "" } = useParams()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  })

  if (isLoading) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-6 w-48" />} />
        <Skeleton className="h-64 w-full" />
      </>
    )
  }

  if (isError || !project) {
    return (
      <PageHeader title="Project not found" description="This project does not exist, or you are not a member of it." />
    )
  }

  const canAdminister = project.myPermissions.includes(ADMINISTER_PROJECT)
  // Whether this project plans in sprints is a property of its board, never of its type (ADR-0012) —
  // so a Kanban team switched onto sprints gets the Backlog tab with no code change here.
  const plansInSprints = project.boardScopeStrategy === "ACTIVE_SPRINT"
  // A KANBAN project opens on its board; every other type opens on the issue list (a TODO project keeps
  // its checklist view). The tab is a URL param so a board deep-link (?tab=board) lands on the board.
  const defaultTab = project.type === "KANBAN" ? "board" : "issues"
  const activeTab = searchParameters.get("tab") ?? defaultTab

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{project.key}</span>
            <span className="font-display text-lg font-semibold tracking-[-0.02em]">{project.name}</span>
          </span>
        }
        description={`Project · ${project.type.charAt(0) + project.type.slice(1).toLowerCase()}`}
      />

      <Tabs value={activeTab} onValueChange={(tab) => setSearchParameters({ tab }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          {plansInSprints && <TabsTrigger value="backlog">Backlog</TabsTrigger>}
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="issues">
          <IssuesPanel projectId={project.id} permissions={project.myPermissions} />
        </TabsContent>

        <TabsContent value="board">
          <BoardPanel projectId={project.id} permissions={project.myPermissions} />
        </TabsContent>

        {plansInSprints && (
          <TabsContent value="backlog">
            <BacklogPanel projectId={project.id} permissions={project.myPermissions} />
          </TabsContent>
        )}

        <TabsContent value="overview">
          <div className="max-w-xl">
            <DetailRow label="Key">
              <span className="font-mono">{project.key}</span>
            </DetailRow>
            <DetailRow label="Type">
              <ProjectTypeBadge type={project.type} />
            </DetailRow>
            <DetailRow label="Lead">
              <MemberChip member={project.lead} />
            </DetailRow>
            <DetailRow label="Issue type scheme">{project.issueTypeScheme?.name ?? "—"}</DetailRow>
            <DetailRow label="Workflow scheme">{project.workflowScheme?.name ?? "—"}</DetailRow>
            <DetailRow label="Key strategy">
              <span className="font-mono text-xs">{project.keyStrategy}</span>
            </DetailRow>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="space-y-8">
            {canAdminister ? (
              <ProjectSettingsForm project={project} />
            ) : (
              <p className="text-sm text-muted-foreground">
                You need the Administer project permission to edit these settings.
              </p>
            )}

            <section className="space-y-2">
              <h3 className="font-display text-sm font-semibold tracking-[-0.01em]">Components</h3>
              <ProjectComponentsPanel projectId={project.id} canAdminister={canAdminister} />
            </section>

            <section className="space-y-2">
              <h3 className="font-display text-sm font-semibold tracking-[-0.01em]">Versions</h3>
              <ProjectVersionsPanel projectId={project.id} canAdminister={canAdminister} />
            </section>
          </div>
        </TabsContent>

        <TabsContent value="access">
          <ProjectAccessPanel projectId={project.id} canAdminister={canAdminister} />
        </TabsContent>
      </Tabs>
    </>
  )
}

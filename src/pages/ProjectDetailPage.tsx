import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectIcon } from "@/components/projects/ProjectIcon"
import { ProjectSettingsPanel } from "@/components/projects/ProjectSettingsPanel"
import { IssuesPanel } from "@/components/issues/IssuesPanel"
import { BoardPanel } from "@/components/board/BoardPanel"
import { BacklogPanel } from "@/components/backlog/BacklogPanel"
import { ShippedPanel } from "@/components/shipped/ShippedPanel"
import { ReportsPanel } from "@/components/reports/ReportsPanel"
import { WikiPanel } from "@/components/wiki/WikiPanel"
import { useLanguage } from "@/context/LanguageContext"
import { ADMINISTER_PROJECT, getProject } from "@/api/projects"
import {
  PROJECT_TAB_LABELS,
  projectStyleLabel,
  projectTabs,
  resolveProjectSettingsSection,
  resolveProjectTab,
  type ProjectSettingsSection,
} from "@/lib/projectStyle"
import { resolveText } from "@/lib/translatableText"

export function ProjectDetailPage() {
  const { t } = useLanguage()
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
  // Which tabs exist and which one a link opens are both derived from the board's scope strategy and
  // nothing else (ADR-0015) — a project switched onto sprints gains its Reports tab with no code change
  // here, and a link to a tab that is gone lands somewhere real rather than on a dead trigger.
  const tabs = projectTabs(project.boardScopeStrategy)
  const activeTab = resolveProjectTab(searchParameters.get("tab"), project.boardScopeStrategy)
  const settingsSection = resolveProjectSettingsSection(searchParameters.get("section"))

  function openTab(tab: string) {
    setSearchParameters(tab === "settings" ? { tab, section: settingsSection } : { tab }, { replace: true })
  }

  function openSettingsSection(section: ProjectSettingsSection) {
    setSearchParameters({ tab: "settings", section }, { replace: true })
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ProjectIcon icon={project.icon} size="lg" />
            <span className="font-mono text-sm text-muted-foreground">{project.key}</span>
            <span className="font-display text-lg font-semibold tracking-[-0.02em]">{project.name}</span>
          </span>
        }
        description={`Project · ${projectStyleLabel(project.boardScopeStrategy)}`}
      />

      <Tabs value={activeTab} onValueChange={openTab}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {resolveText(t, PROJECT_TAB_LABELS[tab])}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="issues">
          <IssuesPanel projectId={project.id} permissions={project.myPermissions} />
        </TabsContent>

        <TabsContent value="board">
          <BoardPanel projectId={project.id} permissions={project.myPermissions} />
        </TabsContent>

        <TabsContent value="backlog">
          <BacklogPanel projectId={project.id} permissions={project.myPermissions} />
        </TabsContent>

        <TabsContent value="shipped">
          <ShippedPanel projectId={project.id} permissions={project.myPermissions} />
        </TabsContent>

        {tabs.includes("reports") && (
          <TabsContent value="reports">
            <ReportsPanel projectId={project.id} permissions={project.myPermissions} />
          </TabsContent>
        )}

        <TabsContent value="wiki">
          <WikiPanel projectId={project.id} permissions={project.myPermissions} />
        </TabsContent>

        <TabsContent value="settings">
          <ProjectSettingsPanel
            project={project}
            canAdminister={canAdminister}
            section={settingsSection}
            onSectionChange={openSettingsSection}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

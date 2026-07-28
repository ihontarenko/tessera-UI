import { CircleDot, Columns3, FolderKanban, Gauge } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/PageHeader"
import { useLanguage } from "@/context/LanguageContext"

// Deliberately light for Phase 0 — no aggregates or charts to show until there are projects and
// issues to summarize. Grows into a real overview (open issues, sprint burndown, velocity) once the
// domain lands. The "what's coming" cards keep the screen populated rather than blank in the meantime.
const upcomingModules = [
  {
    icon: FolderKanban,
    title: "Projects",
    description: "Multi-project workspaces, each with its own issue key, schemes and membership.",
  },
  {
    icon: Columns3,
    title: "Boards",
    description: "Kanban and Scrum boards mapping columns to a configurable workflow, with WIP limits.",
  },
  {
    icon: CircleDot,
    title: "Issues",
    description: "Epics, stories, tasks, bugs and sub-tasks — with comments, links and full history.",
  },
]

export function DashboardPage() {
  const { t } = useLanguage()

  return (
    <>
      <PageHeader
        title={t("dashboard.title", "Dashboard")}
        description={t("dashboard.subtitle", "Tessera — project & issue tracker")}
      />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gauge className="size-5 text-muted-foreground" />
            <CardTitle>Welcome to Tessera</CardTitle>
          </div>
          <CardDescription>
            A Jira-style tracker for the Innoventa workspace — Scrum and Kanban, boards, backlogs and
            dashboards. Sign-in runs through Identity; shared UI copy through Central.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The domain lands next: projects and issues first, then boards, sprints and reports.
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {upcomingModules.map((module) => (
          <Card key={module.title}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <module.icon className="size-5 text-muted-foreground" />
                <CardTitle className="text-base">{module.title}</CardTitle>
              </div>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  )
}

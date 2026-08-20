import { ProjectAccessPanel } from "@/components/projects/ProjectAccessPanel"
import { ProjectBoardSection } from "@/components/projects/settings/ProjectBoardSection"
import { ProjectGeneralSection } from "@/components/projects/settings/ProjectGeneralSection"
import { ProjectIssueTypesSection } from "@/components/projects/settings/ProjectIssueTypesSection"
import { ProjectEstimationSection } from "@/components/projects/settings/ProjectEstimationSection"
import { ProjectDangerSection } from "@/components/projects/settings/ProjectDangerSection"
import { ProjectWorkflowSection } from "@/components/projects/settings/ProjectWorkflowSection"
import { SettingsSection } from "@/components/projects/settings/SettingsSection"
import type { ProjectResponse } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"
import { sectionNavigationItemClass } from "@/lib/sectionNavigation"
import { cn } from "@/lib/helpers"
import { PROJECT_SETTINGS_SECTIONS, type ProjectSettingsSection } from "@/lib/projectStyle"

/** The label for each section, in the order `PROJECT_SETTINGS_SECTIONS` fixes. */
const SECTION_LABELS: Record<ProjectSettingsSection, { key: string; text: string }> = {
  general: { key: "project.settings.nav.general", text: "General" },
  "issue-types": { key: "project.settings.nav.issueTypes", text: "Issue types" },
  workflow: { key: "project.settings.nav.workflow", text: "Workflow" },
  estimation: { key: "project.settings.nav.estimation", text: "Estimation" },
  board: { key: "project.settings.nav.board", text: "Board" },
  access: { key: "project.settings.nav.access", text: "Access" },
  danger: { key: "project.settings.nav.danger", text: "Danger zone" },
}

/**
 * Everything a project decides, in one place with its own navigation (ticket 06). Settings used to be
 * one form, with the project's facts on an Overview tab, its access on an Access tab and its board
 * configuration in a sheet reachable only from the board — three destinations for one job.
 *
 * Which section is open is a URL parameter, so a link to a section is a link to a section.
 */
export function ProjectSettingsPanel({
  project,
  canAdminister,
  section,
  onSectionChange,
}: {
  project: ProjectResponse
  canAdminister: boolean
  section: ProjectSettingsSection
  onSectionChange: (section: ProjectSettingsSection) => void
}) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav className="lg:w-52 lg:shrink-0" aria-label={t("project.settings.nav.label", "Project settings")}>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {PROJECT_SETTINGS_SECTIONS.map((candidate) => (
            <li key={candidate}>
              <button
                type="button"
                onClick={() => onSectionChange(candidate)}
                aria-current={candidate === section ? "page" : undefined}
                // ⚠️ Tinted while it is NOT the open section. Once open it takes the shared active
                // state like every other, because a picker where one entry never looks selected reads
                // as a broken control rather than as a warning.
                className={cn(
                  sectionNavigationItemClass(candidate === section),
                  candidate === "danger" && candidate !== section && "text-destructive hover:text-destructive",
                )}
              >
                {t(SECTION_LABELS[candidate].key, SECTION_LABELS[candidate].text)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        {section === "general" && <ProjectGeneralSection project={project} canAdminister={canAdminister} />}
        {section === "issue-types" && <ProjectIssueTypesSection project={project} canAdminister={canAdminister} />}
        {section === "workflow" && <ProjectWorkflowSection project={project} canAdminister={canAdminister} />}
        {section === "estimation" && (
          <ProjectEstimationSection project={project} canAdminister={canAdminister} />
        )}
        {section === "board" && <ProjectBoardSection projectId={project.id} canAdminister={canAdminister} />}
        {section === "access" && (
          <SettingsSection
            title={t("project.settings.access.title", "Access")}
            description={t(
              "project.settings.access.description",
              "Who is on this project, the roles they hold, and any permission granted or denied to one person.",
            )}
          >
            <ProjectAccessPanel projectId={project.id} canAdminister={canAdminister} />
          </SettingsSection>
        )}
        {section === "danger" && (
          <ProjectDangerSection project={project} canAdminister={canAdminister} />
        )}
      </div>
    </div>
  )
}

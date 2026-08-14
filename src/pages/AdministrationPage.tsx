import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { cn } from "@/lib/helpers"
import { useLanguage } from "@/context/LanguageContext"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import { ADMINISTER_CONFIGURATION } from "@/api/permissions"
import {
  ADMINISTRATION_SECTIONS,
  ADMINISTRATION_SECTION_LABELS,
  isAdministrationSection,
} from "@/components/administration/administrationSections"
import { IssueTypesSection } from "@/components/administration/IssueTypesSection"
import { LinkTypesSection } from "@/components/administration/LinkTypesSection"
import { PrioritiesSection } from "@/components/administration/PrioritiesSection"
import { ResolutionsSection } from "@/components/administration/ResolutionsSection"
import { SchemesSection } from "@/components/administration/SchemesSection"
import { StatusesSection } from "@/components/administration/StatusesSection"
import { WorkflowsSection } from "@/components/administration/WorkflowsSection"

/**
 * Everything the installation's configuration decides, in one place.
 *
 * ⚠️ **The catalogs here are shared by every project, and editing them is in place.** There is no draft
 * and no copy-on-write: renaming a status renames it for everybody on the next request. What replaces
 * safety-by-copying is that every screen says what a change would do before offering to make it.
 *
 * ⚠️ **The route is open and the controls are not.** A member without `configuration:administer` who
 * arrives here by URL reads the pages rather than meeting an error — the reads are open for exactly that
 * reason — and every write route refuses them server-side regardless of what this page renders. A
 * client-side guard is a courtesy and never the authorization.
 *
 * Which section is open is a URL parameter, in the shape project settings already uses, so a link to a
 * section is a link to a section.
 */
export function AdministrationPage() {
  const { t } = useLanguage()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const { data: currentMember } = useCurrentMember()

  const requested = searchParameters.get("section")
  const section = isAdministrationSection(requested) ? requested : ADMINISTRATION_SECTIONS[0]
  const canAdminister = (currentMember?.globalPermissions ?? []).includes(ADMINISTER_CONFIGURATION)

  function openSection(next: string) {
    setSearchParameters({ section: next }, { replace: true })
  }

  return (
    <>
      <PageHeader
        title={t("administration.title", "Administration")}
        description={t(
          "administration.description",
          "The catalogs every project runs on — shared, and edited in place",
        )}
      />

      <div className="flex flex-col gap-6 pt-4 lg:flex-row">
        <nav
          className="lg:w-52 lg:shrink-0"
          aria-label={t("administration.nav.label", "Configuration")}
        >
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {ADMINISTRATION_SECTIONS.map((candidate) => (
              <li key={candidate}>
                <button
                  type="button"
                  onClick={() => openSection(candidate)}
                  aria-current={candidate === section ? "page" : undefined}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors",
                    candidate === section
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {t(
                    ADMINISTRATION_SECTION_LABELS[candidate].key,
                    ADMINISTRATION_SECTION_LABELS[candidate].text,
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          {section === "statuses" && <StatusesSection canAdminister={canAdminister} />}
          {section === "workflows" && <WorkflowsSection canAdminister={canAdminister} />}
          {section === "issue-types" && <IssueTypesSection canAdminister={canAdminister} />}
          {section === "schemes" && <SchemesSection />}
          {section === "priorities" && <PrioritiesSection canAdminister={canAdminister} />}
          {section === "resolutions" && <ResolutionsSection canAdminister={canAdminister} />}
          {section === "link-types" && <LinkTypesSection canAdminister={canAdminister} />}
        </div>
      </div>
    </>
  )
}

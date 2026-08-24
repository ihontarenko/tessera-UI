import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { sectionNavigationItemClass } from "@/lib/sectionNavigation"
import { useLanguage } from "@/context/LanguageContext"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import {
  ADMINISTER_ACCESS,
  ADMINISTER_AI,
  ADMINISTER_CONFIGURATION,
  ADMINISTER_MEMBERS,
  READ_AI,
} from "@/api/permissions"
import {
  ADMINISTRATION_SECTIONS,
  ADMINISTRATION_SECTION_GROUPS,
  ADMINISTRATION_SECTION_LABELS,
  isAdministrationSection,
} from "@/components/administration/administrationSections"
import { AccessSection } from "@/components/administration/AccessSection"
import { AiSection } from "@/components/administration/AiSection"
import { MembersSection } from "@/components/administration/MembersSection"
import { CommentTopicsSection } from "@/components/administration/CommentTopicsSection"
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

  const held = currentMember?.globalPermissions ?? []
  const canAdminister = held.includes(ADMINISTER_CONFIGURATION)
  const canReadAi = held.includes(READ_AI)
  const canAdministerAi = held.includes(ADMINISTER_AI)
  const canAdministerMembers = held.includes(ADMINISTER_MEMBERS)
  const canAdministerAccess = held.includes(ADMINISTER_ACCESS)

  // ⚠️ The one section the navigation hides rather than shows read-only, and the asymmetry is on
  // purpose: the catalogs keep their reads open because every picker in the product is built from
  // them, whereas the AI screen's reads are gated server-side. Offering a tab that can only answer
  // 403 is worse than not offering it — and a member who arrives by URL still meets the section's own
  // refusal, which names the permission to ask for.
  const isOffered = (candidate: string) => {
    if (candidate === "ai") {
      return canReadAi
    }
    if (candidate === "members") {
      return canAdministerMembers
    }
    // ⚠️ Hidden rather than shown read-only, and for the reason the account menu hid it before this
    // screen inherited it: the whole section is controls, and every one of them would answer 403.
    if (candidate === "access") {
      return canAdministerAccess
    }

    return true
  }

  // A group whose every section is hidden is dropped rather than left as a heading with nothing under it.
  const groups = ADMINISTRATION_SECTION_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter(isOffered),
  })).filter((group) => group.sections.length > 0)

  const requested = searchParameters.get("section")
  const section = isAdministrationSection(requested) ? requested : ADMINISTRATION_SECTIONS[0]

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
          {/* Grouped down the side, one flat scrolling row across the top when there is no room for
              headings — the grouping is worth a column and not worth a horizontal accordion. */}
          <div className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-5 lg:overflow-visible">
            {groups.map((group) => (
              <div key={group.id} className="flex gap-1 lg:flex-col lg:gap-1">
                {/* px-2.5 to sit on the same left edge as the items below it. */}
                <h2 className="hidden px-2.5 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase lg:block">
                  {t(group.label.key, group.label.text)}
                </h2>

                <ul className="flex gap-1 lg:flex-col">
                  {group.sections.map((candidate) => (
                    <li key={candidate}>
                      <button
                        type="button"
                        onClick={() => openSection(candidate)}
                        aria-current={candidate === section ? "page" : undefined}
                        className={sectionNavigationItemClass(candidate === section)}
                      >
                        {t(
                          ADMINISTRATION_SECTION_LABELS[candidate].key,
                          ADMINISTRATION_SECTION_LABELS[candidate].text,
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {section === "statuses" && <StatusesSection canAdminister={canAdminister} />}
          {section === "workflows" && <WorkflowsSection canAdminister={canAdminister} />}
          {section === "issue-types" && <IssueTypesSection canAdminister={canAdminister} />}
          {section === "schemes" && <SchemesSection canAdminister={canAdminister} />}
          {section === "priorities" && <PrioritiesSection canAdminister={canAdminister} />}
          {section === "resolutions" && <ResolutionsSection canAdminister={canAdminister} />}
          {section === "link-types" && <LinkTypesSection canAdminister={canAdminister} />}
          {section === "comment-topics" && <CommentTopicsSection canAdminister={canAdminister} />}
          {/* Rendered whether or not the permission is held — the navigation hides this section, but a
              member who arrives by URL should meet the section's own refusal, which names what to ask
              for, rather than a blank pane. */}
          {section === "access" && <AccessSection />}
          {section === "members" && <MembersSection canAdminister={canAdministerMembers} />}
          {section === "ai" && <AiSection canRead={canReadAi} canAdminister={canAdministerAi} />}
        </div>
      </div>
    </>
  )
}

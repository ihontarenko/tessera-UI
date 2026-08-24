/**
 * The Administration screen's sections, grouped the way a person thinks about them.
 *
 * The flat list this used to be put the assistant's machinery one row below Link types, as though an AI
 * provider were another catalog of issue metadata. It is not, and neither are schemes: the four groups
 * below separate *what an issue moves through* (statuses and workflows — the two that carry engine
 * meaning, and the reason this screen exists), *what an issue is described with*, *what decides which
 * project gets which of the above*, and *what belongs to the installation rather than to issues at all*.
 *
 * Groups are presentation only — the section is still a single flat URL parameter, so a link to a section
 * stays a link to a section and no existing link breaks by being regrouped.
 */
const GROUPS = [
  {
    id: "workflow",
    label: { key: "administration.nav.group.workflow", text: "Workflow" },
    sections: ["statuses", "workflows"],
  },
  {
    id: "issue-fields",
    label: { key: "administration.nav.group.issueFields", text: "Issue fields" },
    sections: ["issue-types", "priorities", "resolutions", "link-types", "comment-topics"],
  },
  {
    id: "assignment",
    label: { key: "administration.nav.group.assignment", text: "Project assignment" },
    sections: ["schemes"],
  },
  {
    // The only group the navigation can hide: everything above is what issues are made of and its reads
    // are open to everybody, whereas this is the installation itself — who may do what, who the people
    // are, and the machinery behind the assistant — each behind its own permission. A group that would
    // render empty is dropped rather than left as a bare heading.
    //
    // ⚠️ Access leads it, and it did not use to be on this screen at all: it was `/settings/access`,
    // offered from the account menu beside Appearance. That put the installation's authorization on the
    // shelf marked "about you", which is the one thing it is not.
    id: "platform",
    label: { key: "administration.nav.group.platform", text: "Platform" },
    sections: ["access", "members", "ai"],
  },
] as const

export type AdministrationSectionGroup = (typeof GROUPS)[number]
export type AdministrationSection = AdministrationSectionGroup["sections"][number]

export const ADMINISTRATION_SECTION_GROUPS: readonly AdministrationSectionGroup[] = GROUPS

export const ADMINISTRATION_SECTIONS: readonly AdministrationSection[] = GROUPS.flatMap(
  (group) => group.sections,
)

export const ADMINISTRATION_SECTION_LABELS: Record<AdministrationSection, { key: string; text: string }> = {
  statuses: { key: "administration.nav.statuses", text: "Statuses" },
  workflows: { key: "administration.nav.workflows", text: "Workflows" },
  "issue-types": { key: "administration.nav.issueTypes", text: "Issue types" },
  schemes: { key: "administration.nav.schemes", text: "Schemes" },
  priorities: { key: "administration.nav.priorities", text: "Priorities" },
  resolutions: { key: "administration.nav.resolutions", text: "Resolutions" },
  "link-types": { key: "administration.nav.linkTypes", text: "Link types" },
  "comment-topics": { key: "administration.nav.commentTopics", text: "Comment topics" },
  access: { key: "administration.nav.access", text: "Access" },
  members: { key: "administration.nav.members", text: "Members" },
  ai: { key: "administration.nav.ai", text: "AI" },
}

export function isAdministrationSection(candidate: string | null): candidate is AdministrationSection {
  return candidate !== null && (ADMINISTRATION_SECTIONS as readonly string[]).includes(candidate)
}

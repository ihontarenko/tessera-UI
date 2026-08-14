/**
 * The Administration screen's sections, in the order its navigation offers them.
 *
 * Ordered by what a person edits most often rather than alphabetically, and with the two that carry
 * engine meaning — statuses and workflows — first: they are the reason this screen exists, and the flat
 * catalogs beneath them are the easy part.
 *
 * Which section is open is a URL parameter, so a link to a section is a link to a section — the same
 * arrangement project settings uses.
 */
export const ADMINISTRATION_SECTIONS = [
  "statuses",
  "workflows",
  "issue-types",
  "schemes",
  "priorities",
  "resolutions",
  "link-types",
] as const

export type AdministrationSection = (typeof ADMINISTRATION_SECTIONS)[number]

export const ADMINISTRATION_SECTION_LABELS: Record<AdministrationSection, { key: string; text: string }> = {
  statuses: { key: "administration.nav.statuses", text: "Statuses" },
  workflows: { key: "administration.nav.workflows", text: "Workflows" },
  "issue-types": { key: "administration.nav.issueTypes", text: "Issue types" },
  schemes: { key: "administration.nav.schemes", text: "Schemes" },
  priorities: { key: "administration.nav.priorities", text: "Priorities" },
  resolutions: { key: "administration.nav.resolutions", text: "Resolutions" },
  "link-types": { key: "administration.nav.linkTypes", text: "Link types" },
}

export function isAdministrationSection(candidate: string | null): candidate is AdministrationSection {
  return candidate !== null && (ADMINISTRATION_SECTIONS as readonly string[]).includes(candidate)
}

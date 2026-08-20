import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Badge, Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jmouse/ui"
import { IssueTypeIcon } from "@/components/issues/issueVisuals"
import { EditSchemeLink } from "@/components/projects/settings/EditSchemeLink"
import { SettingsSection } from "@/components/projects/settings/SettingsSection"
import { useProjectUpdate } from "@/components/projects/settings/useProjectUpdate"
import { fetchConfiguration, type Configuration, type ProjectResponse } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"

/** What a hierarchy level means, so the number is not the only thing on offer. */
const HIERARCHY_LABELS: Record<number, string> = {
  1: "Epic level — contains other work",
  0: "Standard level — the unit a board and a sprint plan",
  [-1]: "Sub-task level — always belongs to a parent",
}

/**
 * Which issue types this project may raise. A scheme narrows the global catalog, and since ticket 03
 * the narrowing is a constraint rather than a suggestion — the create dialog offers exactly this list
 * and the API refuses anything outside it.
 *
 * The types are listed for the scheme *currently selected in the dropdown*, not the saved one, so the
 * consequence of a choice is visible before it is made. That is the whole point of the section: a bare
 * scheme name told an administrator nothing about what they were about to change.
 */
export function ProjectIssueTypesSection({
  project,
  canAdminister,
}: {
  project: ProjectResponse
  canAdminister: boolean
}) {
  const { t } = useLanguage()
  const [schemeId, setSchemeId] = useState(project.issueTypeScheme?.id ?? "")
  const { data: configuration } = useQuery({ queryKey: ["configuration"], queryFn: fetchConfiguration })
  const mutation = useProjectUpdate(project, t("project.settings.issueTypes.saved", "Issue type scheme updated"))

  const scheme = configuration?.issueTypeSchemes.find((candidate) => candidate.id === schemeId)
  const grantedTypes = grantedIssueTypes(configuration, scheme)
  const pending = schemeId !== (project.issueTypeScheme?.id ?? "")

  return (
    <SettingsSection
      title={t("project.settings.issueTypes.title", "Issue types")}
      description={t(
        "project.settings.issueTypes.description",
        "The scheme decides which types this project can raise. Nothing outside it can be created.",
      )}
    >
      <div className="max-w-xl space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="settings-issue-type-scheme">{t("project.settings.issueTypes.scheme", "Issue type scheme")}</Label>
          <EditSchemeLink />
        </div>
        <Select value={schemeId} onValueChange={setSchemeId} disabled={!canAdminister}>
          <SelectTrigger id="settings-issue-type-scheme">
            <SelectValue placeholder={t("project.settings.selectScheme", "Select a scheme")} />
          </SelectTrigger>
          <SelectContent>
            {configuration?.issueTypeSchemes.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {scheme?.description && <p className="text-xs text-muted-foreground">{scheme.description}</p>}
      </div>

      <div className="max-w-xl space-y-2">
        <p className="text-sm font-medium">
          {pending
            ? t("project.settings.issueTypes.wouldGrant", "Selecting this scheme would allow")
            : t("project.settings.issueTypes.grants", "This project can raise")}
        </p>

        {grantedTypes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("project.settings.issueTypes.none", "This scheme grants no issue types — nothing could be created.")}
          </p>
        )}

        <ul className="space-y-2">
          {grantedTypes.map((issueType) => (
            <li key={issueType.id} className="flex items-start gap-2.5 rounded-md border p-2.5">
              <IssueTypeIcon type={issueType} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{issueType.name}</span>
                  {issueType.id === scheme?.defaultIssueTypeId && (
                    <Badge variant="secondary">{t("project.settings.issueTypes.default", "Default")}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    `project.settings.issueTypes.level.${issueType.hierarchyLevel}`,
                    HIERARCHY_LABELS[issueType.hierarchyLevel] ?? `Hierarchy level ${issueType.hierarchyLevel}`,
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {canAdminister && (
        <Button
          disabled={!pending || schemeId.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate({ issueTypeSchemeId: schemeId })}
        >
          {mutation.isPending ? t("common.saving", "Saving…") : t("project.settings.issueTypes.apply", "Apply this scheme")}
        </Button>
      )}
    </SettingsSection>
  )
}

/**
 * The scheme's types, in the catalog's order and with the catalog's detail. A scheme stores ids only,
 * so this is the join — and it drops an id the catalog does not know rather than rendering a blank row.
 */
function grantedIssueTypes(
  configuration: Configuration | undefined,
  scheme: Configuration["issueTypeSchemes"][number] | undefined,
) {
  if (!configuration || !scheme) {
    return []
  }

  const granted = new Set(scheme.issueTypeIds)

  return configuration.issueTypes.filter((issueType) => granted.has(issueType.id))
}

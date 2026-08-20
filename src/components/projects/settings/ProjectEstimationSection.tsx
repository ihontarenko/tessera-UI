import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Badge, Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jmouse/ui"
import { EditSchemeLink } from "@/components/projects/settings/EditSchemeLink"
import { SettingsSection } from "@/components/projects/settings/SettingsSection"
import { useProjectUpdate } from "@/components/projects/settings/useProjectUpdate"
import { fetchConfiguration, type ProjectResponse } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"

/** ⚠️ Null is a real answer here, and a select cannot hold one — so it needs a token. */
const NOT_ESTIMATED = "__not_estimated__"

/**
 * How this project estimates, and what its scale offers.
 *
 * ⚠️ **"Not estimated" is the first option and it stores null**, rather than pointing at a scale called
 * None. A project that does not estimate has no story-points control anywhere — not an empty select, not
 * a dash — and null is the only way to say that (ADR-0019).
 *
 * ⚠️ **Changing the scale rewrites nothing.** Every estimate keeps the number it was stored with,
 * because an estimate is stored as its option's weight — which is also why burndown, velocity and the
 * backlog's sums never had to learn that scales exist. An estimate whose number is not on the new scale
 * keeps showing as that number.
 */
export function ProjectEstimationSection({
  project,
  canAdminister,
}: {
  project: ProjectResponse
  canAdminister: boolean
}) {
  const { t } = useLanguage()
  const [schemeId, setSchemeId] = useState(project.estimationScheme?.id ?? NOT_ESTIMATED)
  const { data: configuration } = useQuery({ queryKey: ["configuration"], queryFn: fetchConfiguration })
  const mutation = useProjectUpdate(
    project,
    t("project.settings.estimation.saved", "Estimation scale updated"),
  )

  const scheme = configuration?.estimationSchemes.find((candidate) => candidate.id === schemeId)
  const pending = schemeId !== (project.estimationScheme?.id ?? NOT_ESTIMATED)

  return (
    <SettingsSection
      title={t("project.settings.estimation.title", "Estimation")}
      description={t(
        "project.settings.estimation.description",
        "How this project sizes work. Every estimate is stored as its option's number, so changing the scale leaves every existing estimate exactly where it is.",
      )}
    >
      <div className="max-w-xl space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="settings-estimation-scheme">
            {t("project.settings.estimation.scheme", "Estimation scale")}
          </Label>
          <EditSchemeLink />
        </div>
        <Select value={schemeId} onValueChange={setSchemeId} disabled={!canAdminister}>
          <SelectTrigger id="settings-estimation-scheme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* First, and not a scale: it stores null, and the story-points control disappears. */}
            <SelectItem value={NOT_ESTIMATED}>
              {t("project.settings.estimation.none", "Not estimated")}
            </SelectItem>
            {configuration?.estimationSchemes.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {scheme ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("project.settings.estimation.grants", "What it offers")}
          </p>
          <div className="flex flex-wrap gap-1">
            {scheme.items.map((item) => (
              <Badge key={item.label} variant="outline" title={`Stored as ${item.weight}`}>
                {item.label}
                {item.label !== String(item.weight) && (
                  <span className="ml-1 text-muted-foreground">= {item.weight}</span>
                )}
              </Badge>
            ))}
          </div>
          {scheme.description && <p className="text-xs text-muted-foreground">{scheme.description}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t(
            "project.settings.estimation.noneExplained",
            "This project does not estimate, so no issue in it shows a story-points field at all.",
          )}
        </p>
      )}

      {canAdminister && (
        <Button
          size="sm"
          disabled={!pending || mutation.isPending}
          onClick={() =>
            mutation.mutate({ estimationSchemeId: schemeId === NOT_ESTIMATED ? null : schemeId })
          }
        >
          {mutation.isPending ? t("common.saving", "Saving…") : t("common.save", "Save")}
        </Button>
      )}
    </SettingsSection>
  )
}

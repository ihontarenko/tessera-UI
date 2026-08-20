import { useState } from "react"
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jmouse/ui"
import { useCatalogMutation } from "@/components/administration/AdministrationPieces"
import { setInstanceDefaults, type InstanceDefaults } from "@/api/configurationAdministration"
import type {
  EstimationSchemeSummary,
  IssueTypeSchemeSummary,
  WorkflowSchemeSummary,
} from "@/api/projects"

/** The select cannot hold null, and "" is falsy — so "does not estimate" needs a token of its own. */
const NOT_ESTIMATED = "__not_estimated__"

interface InstanceDefaultsCardProperties {
  defaults: InstanceDefaults | undefined
  issueTypeSchemes: IssueTypeSchemeSummary[]
  workflowSchemes: WorkflowSchemeSummary[]
  estimationSchemes: EstimationSchemeSummary[]
  canAdminister: boolean
}

/**
 * What a new project starts on.
 *
 * ⚠️ **This changes the next project and no existing one.** It is a starting point, not a bulk edit
 * wearing a settings screen's clothes — every project that already exists keeps the schemes it has, and
 * changes them in its own settings.
 *
 * ⚠️ **It exists because two scheme identifiers used to be string constants in `ProjectService`.** That
 * was fine while schemes were seeded and read-only. The moment a screen could delete one, a constant
 * became a way to break project creation from here — with the break arriving at whoever next created a
 * project rather than at the click that caused it. Stored and foreign-keyed, the delete is refused
 * instead, naming what the scheme is.
 */
export function InstanceDefaultsCard({
  defaults,
  issueTypeSchemes,
  workflowSchemes,
  estimationSchemes,
  canAdminister,
}: InstanceDefaultsCardProperties) {
  const [issueTypeSchemeId, setIssueTypeSchemeId] = useState<string | null>(null)
  const [workflowSchemeId, setWorkflowSchemeId] = useState<string | null>(null)
  // ⚠️ Two nulls with different meanings, so the pending edit is tracked as the token.
  const [estimationSchemeId, setEstimationSchemeId] = useState<string | null>(null)

  const chosenIssueTypeScheme = issueTypeSchemeId ?? defaults?.defaultIssueTypeSchemeId ?? ""
  const chosenWorkflowScheme = workflowSchemeId ?? defaults?.defaultWorkflowSchemeId ?? ""

  const chosenEstimationScheme =
    estimationSchemeId ?? defaults?.defaultEstimationSchemeId ?? NOT_ESTIMATED

  const changed =
    Boolean(defaults) &&
    (chosenIssueTypeScheme !== defaults!.defaultIssueTypeSchemeId ||
      chosenWorkflowScheme !== defaults!.defaultWorkflowSchemeId ||
      chosenEstimationScheme !== (defaults!.defaultEstimationSchemeId ?? NOT_ESTIMATED))

  const save = useCatalogMutation({
    mutationFn: () =>
      setInstanceDefaults({
        defaultIssueTypeSchemeId: chosenIssueTypeScheme,
        defaultWorkflowSchemeId: chosenWorkflowScheme,
        defaultEstimationSchemeId:
          chosenEstimationScheme === NOT_ESTIMATED ? null : chosenEstimationScheme,
      }),
    success: "New projects will start on these",
    failure: "Could not change the defaults",
    onDone: () => {
      setIssueTypeSchemeId(null)
      setWorkflowSchemeId(null)
      setEstimationSchemeId(null)
    },
  })

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <header className="space-y-1">
        <h3 className="text-sm font-medium">What a new project starts on</h3>
        <p className="text-xs text-muted-foreground">
          A starting point, not a rule: every project changes its own schemes afterwards, and nothing that
          already exists is touched by a change here.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Issue-type scheme</Label>
          <Select
            value={chosenIssueTypeScheme}
            onValueChange={setIssueTypeSchemeId}
            disabled={!canAdminister}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a scheme" />
            </SelectTrigger>
            <SelectContent>
              {issueTypeSchemes.map((scheme) => (
                <SelectItem key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Workflow scheme</Label>
          <Select value={chosenWorkflowScheme} onValueChange={setWorkflowSchemeId} disabled={!canAdminister}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a scheme" />
            </SelectTrigger>
            <SelectContent>
              {workflowSchemes.map((scheme) => (
                <SelectItem key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Estimation scale</Label>
          <Select
            value={chosenEstimationScheme}
            onValueChange={setEstimationSchemeId}
            disabled={!canAdminister}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* ⚠️ First, and a real answer: an installation may simply not estimate. */}
              <SelectItem value={NOT_ESTIMATED}>Not estimated</SelectItem>
              {estimationSchemes.map((scheme) => (
                <SelectItem key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {canAdminister && (
        <div className="flex justify-end">
          <Button size="sm" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save defaults"}
          </Button>
        </div>
      )}
    </section>
  )
}

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusPill } from "@/components/issues/issueVisuals"
import { SettingsSection } from "@/components/projects/settings/SettingsSection"
import { useProjectUpdate } from "@/components/projects/settings/useProjectUpdate"
import { fetchConfiguration, type Configuration, type ProjectResponse } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"

/**
 * The workflow a scheme grants, rendered so it can be read: which workflow applies to which issue
 * types, which statuses it can reach, and every legal move between them.
 *
 * Read-only on purpose. Authoring workflows is a separate effort and out of this spec's scope — what
 * was missing was not an editor but any way at all to see what a scheme does before selecting it. A
 * workflow with no `IN_PROGRESS` status is also what gives a board two columns rather than three
 * (ticket 04), so this section explains the board as much as it explains the issue.
 */
export function ProjectWorkflowSection({
  project,
  canAdminister,
}: {
  project: ProjectResponse
  canAdminister: boolean
}) {
  const { t } = useLanguage()
  const [schemeId, setSchemeId] = useState(project.workflowScheme?.id ?? "")
  const { data: configuration } = useQuery({ queryKey: ["configuration"], queryFn: fetchConfiguration })
  const mutation = useProjectUpdate(project, t("project.settings.workflow.saved", "Workflow scheme updated"))

  const scheme = configuration?.workflowSchemes.find((candidate) => candidate.id === schemeId)
  const assignments = workflowAssignments(configuration, scheme)
  const pending = schemeId !== (project.workflowScheme?.id ?? "")

  return (
    <SettingsSection
      title={t("project.settings.workflow.title", "Workflow")}
      description={t(
        "project.settings.workflow.description",
        "The statuses this project's issues can hold, and the moves between them. Read-only — schemes are not authored here.",
      )}
    >
      <div className="max-w-xl space-y-1.5">
        <Label htmlFor="settings-workflow-scheme">{t("project.settings.workflow.scheme", "Workflow scheme")}</Label>
        <Select value={schemeId} onValueChange={setSchemeId} disabled={!canAdminister}>
          <SelectTrigger id="settings-workflow-scheme">
            <SelectValue placeholder={t("project.settings.selectScheme", "Select a scheme")} />
          </SelectTrigger>
          <SelectContent>
            {configuration?.workflowSchemes.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {scheme?.description && <p className="text-xs text-muted-foreground">{scheme.description}</p>}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">
          {pending
            ? t("project.settings.workflow.wouldGrant", "Selecting this scheme would give")
            : t("project.settings.workflow.grants", "This project runs")}
        </p>

        {assignments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("project.settings.workflow.none", "This scheme has no workflow — no issue could move anywhere.")}
          </p>
        )}

        {assignments.map((assignment) => (
          <WorkflowCard key={assignment.workflow.id} assignment={assignment} configuration={configuration} />
        ))}
      </div>

      {canAdminister && (
        <Button
          disabled={!pending || schemeId.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate({ workflowSchemeId: schemeId })}
        >
          {mutation.isPending ? t("common.saving", "Saving…") : t("project.settings.workflow.apply", "Apply this scheme")}
        </Button>
      )}
    </SettingsSection>
  )
}

interface WorkflowAssignment {
  workflow: Configuration["workflows"][number]
  /** Empty when this is the scheme's default — it applies to everything without an override. */
  issueTypeNames: string[]
  isDefault: boolean
}

/**
 * One card per workflow the scheme actually uses, each knowing which issue types it covers.
 *
 * A scheme is a default plus per-type overrides, which reads naturally as "these types work like this"
 * and very badly as a list of type→workflow pairs. Two types sharing an override share a card.
 */
function workflowAssignments(
  configuration: Configuration | undefined,
  scheme: Configuration["workflowSchemes"][number] | undefined,
): WorkflowAssignment[] {
  if (!configuration || !scheme) {
    return []
  }

  const workflowById = new Map(configuration.workflows.map((workflow) => [workflow.id, workflow]))
  const issueTypeById = new Map(configuration.issueTypes.map((issueType) => [issueType.id, issueType]))
  const assignments = new Map<string, WorkflowAssignment>()

  function assignmentFor(workflowId: string, isDefault: boolean): WorkflowAssignment | null {
    const workflow = workflowById.get(workflowId)
    if (!workflow) {
      return null
    }

    const existing = assignments.get(workflowId)
    if (existing) {
      return existing
    }

    const created: WorkflowAssignment = { workflow, issueTypeNames: [], isDefault }
    assignments.set(workflowId, created)

    return created
  }

  if (scheme.defaultWorkflowId) {
    assignmentFor(scheme.defaultWorkflowId, true)
  }

  for (const mapping of scheme.mappings) {
    const assignment = assignmentFor(mapping.workflowId, false)
    const issueType = issueTypeById.get(mapping.issueTypeId)
    if (assignment && issueType) {
      assignment.issueTypeNames.push(issueType.name)
    }
  }

  return [...assignments.values()]
}

function WorkflowCard({
  assignment,
  configuration,
}: {
  assignment: WorkflowAssignment
  configuration: Configuration | undefined
}) {
  const { t } = useLanguage()
  const statusById = new Map((configuration?.statuses ?? []).map((status) => [status.id, status]))
  const { workflow, issueTypeNames, isDefault } = assignment

  // A transition with no origin is how an issue comes into existence, so it is shown as the starting
  // point rather than as a move from nowhere.
  const initialTransitions = workflow.transitions.filter((transition) => !transition.fromStatusId)
  const moves = workflow.transitions.filter((transition) => transition.fromStatusId)
  const reachableStatusIds = new Set(workflow.transitions.map((transition) => transition.toStatusId))

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{workflow.name}</span>
        {isDefault && (
          <Badge variant="secondary">{t("project.settings.workflow.appliesToAll", "Every issue type")}</Badge>
        )}
        {issueTypeNames.map((issueTypeName) => (
          <Badge key={issueTypeName} variant="outline">
            {issueTypeName}
          </Badge>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">{t("project.settings.workflow.statuses", "Statuses")}</p>
        <div className="flex flex-wrap gap-1.5">
          {[...reachableStatusIds].map((statusId) => (
            <StatusPill key={statusId} status={statusById.get(statusId) ?? null} />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">{t("project.settings.workflow.transitions", "Transitions")}</p>
        <ul className="space-y-1">
          {initialTransitions.map((transition) => (
            <li key={transition.id} className="flex flex-wrap items-center gap-1.5 text-sm">
              <Flag className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{t("project.settings.workflow.created", "Created as")}</span>
              <StatusPill status={statusById.get(transition.toStatusId) ?? null} />
            </li>
          ))}
          {moves.map((transition) => (
            <li key={transition.id} className="flex flex-wrap items-center gap-1.5 text-sm">
              <StatusPill status={statusById.get(transition.fromStatusId ?? "") ?? null} />
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <StatusPill status={statusById.get(transition.toStatusId) ?? null} />
              <span className="text-xs text-muted-foreground">{transition.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

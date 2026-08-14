import { useQuery } from "@tanstack/react-query"
import {
  AdministrationSection,
  ReadOnlyNotice,
} from "@/components/administration/AdministrationPieces"
import { InstanceDefaultsCard } from "@/components/administration/schemes/InstanceDefaultsCard"
import { IssueTypeSchemePanel } from "@/components/administration/schemes/IssueTypeSchemePanel"
import { WorkflowSchemePanel } from "@/components/administration/schemes/WorkflowSchemePanel"
import { fetchInstanceDefaults, fetchSchemeUsage } from "@/api/configurationAdministration"
import { fetchConfiguration } from "@/api/projects"

/**
 * What each scheme grants, whose work it decides, and which pair a new project starts on.
 *
 * ⚠️ **Editing is in place and shared, and the blast radius is on the screen permanently.** Narrowing a
 * scheme narrows it for every project on it on the next request — so the projects are listed on the row
 * rather than appearing in a confirmation, which would tell an administrator after they had decided.
 *
 * ⚠️ **A scheme cannot be deleted while a project points at it or while it is an instance default**, and
 * both refusals name what is holding it. The second one is the reason `instance_settings` exists at all:
 * project creation used to name two schemes as string constants in Java, which nothing could refuse.
 *
 * The section is a frame, not an editor — each kind owns its own panel, because the two are the same
 * shape only until the details start (order and a preselected member on one side, a fallback and
 * per-type overrides on the other).
 */
export function SchemesSection({ canAdminister }: { canAdminister: boolean }) {
  const { data: configuration } = useQuery({ queryKey: ["configuration"], queryFn: fetchConfiguration })
  const { data: usage } = useQuery({
    queryKey: ["administration", "scheme-usage"],
    queryFn: fetchSchemeUsage,
  })
  const { data: defaults } = useQuery({
    queryKey: ["administration", "instance-defaults"],
    queryFn: fetchInstanceDefaults,
  })

  const issueTypes = configuration?.issueTypes ?? []
  const issueTypeSchemes = configuration?.issueTypeSchemes ?? []
  const workflowSchemes = configuration?.workflowSchemes ?? []

  return (
    <AdministrationSection
      title="Schemes"
      description="Which issue types a project may raise, and which workflow each of them runs under. A scheme is shared: every project on it sees the same answer."
    >
      {!canAdminister && <ReadOnlyNotice />}

      <InstanceDefaultsCard
        defaults={defaults}
        issueTypeSchemes={issueTypeSchemes}
        workflowSchemes={workflowSchemes}
        canAdminister={canAdminister}
      />

      <IssueTypeSchemePanel
        schemes={issueTypeSchemes}
        issueTypes={issueTypes}
        projectsByScheme={usage?.byIssueTypeScheme ?? {}}
        defaultSchemeId={defaults?.defaultIssueTypeSchemeId}
        canAdminister={canAdminister}
      />

      <WorkflowSchemePanel
        schemes={workflowSchemes}
        workflows={configuration?.workflows ?? []}
        issueTypes={issueTypes}
        projectsByScheme={usage?.byWorkflowScheme ?? {}}
        defaultSchemeId={defaults?.defaultWorkflowSchemeId}
        canAdminister={canAdminister}
      />
    </AdministrationSection>
  )
}

import { useQuery } from "@tanstack/react-query"
import { Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdministrationSection } from "@/components/administration/AdministrationPieces"
import { fetchConfiguration, listProjects } from "@/api/projects"

/**
 * What each scheme grants, and which projects it is in force in.
 *
 * ⚠️ **Read-only this round, and the banner says so rather than hiding the fact.** Composing a scheme —
 * which issue types it grants, which workflow each type runs under, and which pair a new project starts
 * with — is the next ticket in this cluster. What was missing before it was not an editor but any way at
 * all to see, from one place, whose work a scheme decides.
 */
export function SchemesSection() {
  const { data: configuration } = useQuery({ queryKey: ["configuration"], queryFn: fetchConfiguration })
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects })

  const issueTypeById = new Map((configuration?.issueTypes ?? []).map((issueType) => [issueType.id, issueType]))
  const workflowById = new Map((configuration?.workflows ?? []).map((workflow) => [workflow.id, workflow]))

  return (
    <AdministrationSection
      title="Schemes"
      description="Which issue types a project may raise, and which workflow each of them runs under. A scheme is shared: every project on it sees the same answer."
    >
      <Alert>
        <Info className="size-4" />
        <AlertTitle>Composing a scheme is not here yet</AlertTitle>
        <AlertDescription>
          A project chooses which scheme it uses in its own settings. Changing what a scheme <em>contains</em>
          — and which pair a new project starts with — lands with the next ticket in this cluster.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Issue-type schemes</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scheme</TableHead>
              <TableHead>Grants</TableHead>
              <TableHead className="w-40">Default type</TableHead>
              <TableHead>Used by projects</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(configuration?.issueTypeSchemes ?? []).map((scheme) => (
              <TableRow key={scheme.id}>
                <TableCell className="font-medium">
                  {scheme.name}
                  {scheme.description && (
                    <p className="text-xs text-muted-foreground">{scheme.description}</p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {scheme.issueTypeIds.map((issueTypeId) => (
                      <Badge key={issueTypeId} variant="outline">
                        {issueTypeById.get(issueTypeId)?.name ?? issueTypeId}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {scheme.defaultIssueTypeId
                    ? (issueTypeById.get(scheme.defaultIssueTypeId)?.name ?? scheme.defaultIssueTypeId)
                    : "—"}
                </TableCell>
                <TableCell>
                  <ProjectKeys
                    keys={projects
                      .filter((project) => project.issueTypeScheme?.id === scheme.id)
                      .map((project) => project.key)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Workflow schemes</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scheme</TableHead>
              <TableHead className="w-48">Default workflow</TableHead>
              <TableHead>Per-type overrides</TableHead>
              <TableHead>Used by projects</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(configuration?.workflowSchemes ?? []).map((scheme) => (
              <TableRow key={scheme.id}>
                <TableCell className="font-medium">
                  {scheme.name}
                  {scheme.description && (
                    <p className="text-xs text-muted-foreground">{scheme.description}</p>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {scheme.defaultWorkflowId
                    ? (workflowById.get(scheme.defaultWorkflowId)?.name ?? scheme.defaultWorkflowId)
                    : "—"}
                </TableCell>
                <TableCell>
                  {scheme.mappings.length === 0 ? (
                    <span className="text-xs text-muted-foreground">None — every type runs the default</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {scheme.mappings.map((mapping) => (
                        <li key={`${mapping.issueTypeId}-${mapping.workflowId}`} className="text-xs">
                          {issueTypeById.get(mapping.issueTypeId)?.name ?? mapping.issueTypeId} →{" "}
                          {workflowById.get(mapping.workflowId)?.name ?? mapping.workflowId}
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
                <TableCell>
                  <ProjectKeys
                    keys={projects
                      .filter((project) => project.workflowScheme?.id === scheme.id)
                      .map((project) => project.key)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdministrationSection>
  )
}

/** Projects by key — nobody recognises a project by its identifier, and a key is what they paste. */
function ProjectKeys({ keys }: { keys: string[] }) {
  if (keys.length === 0) {
    return <span className="text-xs text-muted-foreground">No project uses it</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((key) => (
        <Badge key={key} variant="secondary" className="font-mono text-[11px]">
          {key}
        </Badge>
      ))}
    </div>
  )
}

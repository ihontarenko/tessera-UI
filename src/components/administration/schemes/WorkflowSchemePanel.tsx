import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CatalogDialog,
  DeleteWithUsage,
  useCatalogMutation,
} from "@/components/administration/AdministrationPieces"
import { SchemeProjects } from "@/components/administration/schemes/SchemeProjects"
import {
  createWorkflowScheme,
  deleteWorkflowScheme,
  fetchWorkflowSchemeUsage,
  updateWorkflowScheme,
  type IssueTypeResponse,
  type ProjectReference,
} from "@/api/configurationAdministration"
import type { WorkflowSchemeSummary, WorkflowSummary } from "@/api/projects"

interface WorkflowSchemePanelProperties {
  schemes: WorkflowSchemeSummary[]
  workflows: WorkflowSummary[]
  issueTypes: IssueTypeResponse[]
  projectsByScheme: Record<string, ProjectReference[]>
  defaultSchemeId: string | undefined
  canAdminister: boolean
}

interface Draft {
  id: string | null
  name: string
  description: string
  defaultWorkflowId: string
  mappings: { issueTypeId: string; workflowId: string }[]
}

const BLANK: Draft = { id: null, name: "", description: "", defaultWorkflowId: "", mappings: [] }

/**
 * Which workflow an issue runs on — one fallback, and an override per type where a type differs.
 *
 * ⚠️ **A type with no override is not missing anything.** The fallback is the answer for everything not
 * listed, which is what makes a scheme with no overrides an ordinary scheme rather than an unfinished
 * one. Overrides are the exception and the model keeps them that way rather than materialising a row
 * per type.
 */
export function WorkflowSchemePanel({
  schemes,
  workflows,
  issueTypes,
  projectsByScheme,
  defaultSchemeId,
  canAdminister,
}: WorkflowSchemePanelProperties) {
  const [draft, setDraft] = useState<Draft | null>(null)

  const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]))
  const issueTypeById = new Map(issueTypes.map((issueType) => [issueType.id, issueType]))

  const save = useCatalogMutation({
    mutationFn: () =>
      draft?.id ? updateWorkflowScheme(draft.id, request(draft)) : createWorkflowScheme(request(draft!)),
    success: "Scheme saved",
    failure: "Could not save the scheme",
    onDone: () => setDraft(null),
  })

  const canSubmit = Boolean(draft) && draft!.name.trim().length > 0 && draft!.defaultWorkflowId.length > 0

  const unmapped = draft
    ? issueTypes.filter(
        (issueType) => !draft.mappings.some((mapping) => mapping.issueTypeId === issueType.id),
      )
    : []

  return (
    <section className="space-y-2">
      <header className="flex items-end justify-between gap-3">
        <h3 className="text-sm font-medium">Workflow schemes</h3>
        {canAdminister && (
          <Button size="sm" variant="outline" onClick={() => setDraft(BLANK)}>
            New scheme
          </Button>
        )}
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scheme</TableHead>
            <TableHead className="w-48">Everything else runs</TableHead>
            <TableHead>Per-type overrides</TableHead>
            <TableHead>Used by projects</TableHead>
            {canAdminister && <TableHead className="w-32 text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {schemes.map((scheme) => (
            <TableRow key={scheme.id}>
              <TableCell className="font-medium">
                <div className="flex flex-wrap items-center gap-1.5">
                  {scheme.name}
                  {scheme.id === defaultSchemeId && (
                    <Badge variant="secondary" className="text-[11px]">
                      New projects start here
                    </Badge>
                  )}
                </div>
                {scheme.description && <p className="text-xs text-muted-foreground">{scheme.description}</p>}
              </TableCell>
              <TableCell className="text-sm">
                {scheme.defaultWorkflowId
                  ? (workflowById.get(scheme.defaultWorkflowId)?.name ?? scheme.defaultWorkflowId)
                  : "—"}
              </TableCell>
              <TableCell>
                {scheme.mappings.length === 0 ? (
                  <span className="text-xs text-muted-foreground">None — every type runs the fallback</span>
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
                <SchemeProjects projects={projectsByScheme[scheme.id] ?? []} />
              </TableCell>
              {canAdminister && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          id: scheme.id,
                          name: scheme.name,
                          description: scheme.description ?? "",
                          defaultWorkflowId: scheme.defaultWorkflowId ?? "",
                          mappings: scheme.mappings.map((mapping) => ({ ...mapping })),
                        })
                      }
                    >
                      Edit
                    </Button>
                    <DeleteWithUsage
                      name={scheme.name}
                      noun="scheme"
                      usageQueryKey={["administration", "workflow-scheme-usage", scheme.id]}
                      fetchUsage={() => fetchWorkflowSchemeUsage(scheme.id)}
                      onDelete={() => deleteWorkflowScheme(scheme.id)}
                      onDeleted={() => undefined}
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CatalogDialog
        open={draft !== null}
        onOpenChange={(open) => setDraft(open ? draft : null)}
        title={draft?.id ? "Edit scheme" : "New workflow scheme"}
        description="One workflow everything runs on, and an override for each type that differs."
        submitLabel="Save scheme"
        canSubmit={canSubmit}
        isPending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        {draft && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="workflow-scheme-name">Name</Label>
                <Input
                  id="workflow-scheme-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workflow-scheme-description">Description</Label>
                <Input
                  id="workflow-scheme-description"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Everything without an override runs</Label>
              <Select
                value={draft.defaultWorkflowId}
                onValueChange={(workflowId) => setDraft({ ...draft, defaultWorkflowId: workflowId })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a workflow" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Overrides</Label>

              {draft.mappings.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  None. Every issue type runs the workflow above, which is a complete scheme.
                </p>
              )}

              <ul className="space-y-1.5">
                {draft.mappings.map((mapping, index) => (
                  <li key={mapping.issueTypeId} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 truncate text-sm">
                      {issueTypeById.get(mapping.issueTypeId)?.name ?? mapping.issueTypeId}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={mapping.workflowId}
                      onValueChange={(workflowId) =>
                        setDraft({ ...draft, mappings: replaceAt(draft.mappings, index, { workflowId }) })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a workflow" />
                      </SelectTrigger>
                      <SelectContent>
                        {workflows.map((workflow) => (
                          <SelectItem key={workflow.id} value={workflow.id}>
                            {workflow.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Remove override"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          mappings: draft.mappings.filter((_entry, position) => position !== index),
                        })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              {unmapped.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {unmapped.map((issueType) => (
                    <Button
                      key={issueType.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          mappings: [
                            ...draft.mappings,
                            { issueTypeId: issueType.id, workflowId: draft.defaultWorkflowId },
                          ],
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                      {issueType.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CatalogDialog>
    </section>
  )
}

function replaceAt(
  mappings: { issueTypeId: string; workflowId: string }[],
  index: number,
  change: { workflowId: string },
) {
  return mappings.map((mapping, position) =>
    position === index ? { ...mapping, ...change } : mapping,
  )
}

function request(draft: Draft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    defaultWorkflowId: draft.defaultWorkflowId,
    mappings: draft.mappings,
  }
}

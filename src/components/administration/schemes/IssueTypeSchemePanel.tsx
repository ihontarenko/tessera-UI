import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Badge, Button, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@jmouse/ui"
import {
  CatalogDialog,
  DeleteWithUsage,
  useCatalogMutation,
} from "@/components/administration/AdministrationPieces"
import { SchemeMembershipEditor } from "@/components/administration/schemes/SchemeMembershipEditor"
import { SchemeProjects } from "@/components/administration/schemes/SchemeProjects"
import {
  createIssueTypeScheme,
  deleteIssueTypeScheme,
  fetchIssueTypeSchemeUsage,
  fetchSchemeRemovalImpact,
  updateIssueTypeScheme,
  type IssueTypeResponse,
  type ProjectReference,
} from "@/api/configurationAdministration"
import type { IssueTypeSchemeSummary } from "@/api/projects"

interface IssueTypeSchemePanelProperties {
  schemes: IssueTypeSchemeSummary[]
  issueTypes: IssueTypeResponse[]
  projectsByScheme: Record<string, ProjectReference[]>
  defaultSchemeId: string | undefined
  canAdminister: boolean
}

/** The form's state — a scheme being written, before it is one. */
interface Draft {
  id: string | null
  name: string
  description: string
  issueTypeIds: string[]
  defaultIssueTypeId: string
}

const BLANK: Draft = { id: null, name: "", description: "", issueTypeIds: [], defaultIssueTypeId: "" }

/**
 * Which issue types a project may raise, in what order, and which one is preselected.
 *
 * ⚠️ **Editing is in place and shared.** Narrowing a scheme narrows it for every project on it on the
 * next request — which is why the projects are listed on the row permanently rather than appearing in
 * a confirmation after the decision has been made.
 */
export function IssueTypeSchemePanel({
  schemes,
  issueTypes,
  projectsByScheme,
  defaultSchemeId,
  canAdminister,
}: IssueTypeSchemePanelProperties) {
  const [draft, setDraft] = useState<Draft | null>(null)

  const issueTypeById = new Map(issueTypes.map((issueType) => [issueType.id, issueType]))

  const save = useCatalogMutation({
    mutationFn: () =>
      draft?.id
        ? updateIssueTypeScheme(draft.id, request(draft))
        : createIssueTypeScheme(request(draft!)),
    success: "Scheme saved",
    failure: "Could not save the scheme",
    onDone: () => setDraft(null),
  })

  const canSubmit =
    Boolean(draft) &&
    draft!.name.trim().length > 0 &&
    draft!.issueTypeIds.length > 0 &&
    draft!.defaultIssueTypeId.length > 0

  return (
    <section className="space-y-2">
      <header className="flex items-end justify-between gap-3">
        <h3 className="text-sm font-medium">Issue-type schemes</h3>
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
            <TableHead>Grants</TableHead>
            <TableHead className="w-36">Preselected</TableHead>
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
                          issueTypeIds: [...scheme.issueTypeIds],
                          defaultIssueTypeId: scheme.defaultIssueTypeId ?? "",
                        })
                      }
                    >
                      Edit
                    </Button>
                    <DeleteWithUsage
                      name={scheme.name}
                      noun="scheme"
                      usageQueryKey={["administration", "issue-type-scheme-usage", scheme.id]}
                      fetchUsage={() => fetchIssueTypeSchemeUsage(scheme.id)}
                      onDelete={() => deleteIssueTypeScheme(scheme.id)}
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
        title={draft?.id ? "Edit scheme" : "New issue-type scheme"}
        description="Which issue types a project on this scheme may raise, in the order its pickers offer them."
        submitLabel="Save scheme"
        canSubmit={canSubmit}
        isPending={save.isPending}
        onSubmit={() => save.mutate()}
        size="wide"
      >
        {draft && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="scheme-name">Name</Label>
                <Input
                  id="scheme-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scheme-description">Description</Label>
                <Input
                  id="scheme-description"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
            </div>

            <SchemeMembershipEditor
              allIssueTypes={issueTypes}
              selectedIds={draft.issueTypeIds}
              defaultId={draft.defaultIssueTypeId}
              onChange={(issueTypeIds, defaultIssueTypeId) =>
                setDraft({ ...draft, issueTypeIds, defaultIssueTypeId })
              }
            />

            <RemovalImpacts
              schemeId={draft.id}
              removed={removedFrom(schemes, draft)}
              issueTypeById={issueTypeById}
            />
          </>
        )}
      </CatalogDialog>
    </section>
  )
}

/**
 * What the types being dropped already hold.
 *
 * ⚠️ **A warning, never a block.** Those issues keep their type and stay perfectly readable; what stops
 * is raising new ones on this scheme. Refusing the removal would make a scheme unnarrowable the moment
 * anybody used it, which is the opposite of what an editable scheme is for.
 */
function RemovalImpacts({
  schemeId,
  removed,
  issueTypeById,
}: {
  schemeId: string | null
  removed: string[]
  issueTypeById: Map<string, IssueTypeResponse>
}) {
  if (!schemeId || removed.length === 0) {
    return null
  }

  return (
    <div className="space-y-1 rounded-md border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Dropping {removed.map((issueTypeId) => issueTypeById.get(issueTypeId)?.name ?? issueTypeId).join(", ")}
      </p>
      {removed.map((issueTypeId) => (
        <RemovalImpact key={issueTypeId} schemeId={schemeId} issueTypeId={issueTypeId} />
      ))}
    </div>
  )
}

function RemovalImpact({ schemeId, issueTypeId }: { schemeId: string; issueTypeId: string }) {
  const { data: impact } = useQuery({
    queryKey: ["administration", "scheme-removal-impact", schemeId, issueTypeId],
    queryFn: () => fetchSchemeRemovalImpact(schemeId, issueTypeId),
  })

  if (!impact) {
    return null
  }

  return (
    <p className="text-xs">
      <span className="font-medium">{impact.issueTypeName}</span>{" "}
      {impact.issues === 0 ? (
        <span className="text-muted-foreground">
          — no issue of this type exists in the {impact.projects} project
          {impact.projects === 1 ? "" : "s"} on this scheme.
        </span>
      ) : (
        <span className="text-muted-foreground">
          — {impact.issues} issue{impact.issues === 1 ? "" : "s"} of this type already exist here. They keep
          their type; no new ones can be raised.
        </span>
      )}
    </p>
  )
}

/** Which members the draft has dropped since it was opened — nothing at all for a new scheme. */
function removedFrom(schemes: IssueTypeSchemeSummary[], draft: Draft) {
  const stored = schemes.find((scheme) => scheme.id === draft.id)

  if (!stored) {
    return []
  }

  return stored.issueTypeIds.filter((issueTypeId) => !draft.issueTypeIds.includes(issueTypeId))
}

function request(draft: Draft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    defaultIssueTypeId: draft.defaultIssueTypeId,
    issueTypeIds: draft.issueTypeIds,
  }
}

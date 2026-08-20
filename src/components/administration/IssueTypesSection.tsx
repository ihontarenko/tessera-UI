import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jmouse/ui"
import { IssueTypeIcon } from "@/components/issues/issueVisuals"
import {
  AdministrationSection,
  CatalogDialog,
  DeleteWithUsage,
  ReadOnlyNotice,
  RenameWarning,
  useCatalogMutation,
} from "@/components/administration/AdministrationPieces"
import {
  createIssueType,
  deleteIssueType,
  fetchConfigurationCounts,
  fetchIssueTypeIcons,
  fetchIssueTypeLevelImpact,
  fetchIssueTypeUsage,
  updateIssueType,
  type IssueTypeResponse,
} from "@/api/configurationAdministration"
import { fetchConfiguration } from "@/api/projects"

/**
 * The three levels that exist today, named.
 *
 * ⚠️ **The number is shown beside the name deliberately.** The level is an integer in the model — an
 * Initiative at 2 was always anticipated — so the picker offers the three that exist rather than
 * pretending the field is an enum, and nobody has to know that −1 means sub-task.
 */
const LEVELS: Array<{ value: number; label: string; hint: string }> = [
  // ⚠️ The level the model always anticipated and the picker never offered, so a type above Epic could
  // only be made by calling the API by hand. Nothing in the backend forbade it — `IssueTypeRequest`
  // takes a bare `int` with no range — which is exactly why the omission was invisible.
  { value: 2, label: "Portfolio (2)", hint: "Holds containers — an Initiative, or a Hub" },
  { value: 1, label: "Container (1)", hint: "Holds other work — an Epic" },
  { value: 0, label: "Standard (0)", hint: "What a board shows and a sprint plans" },
  { value: -1, label: "Sub-task (−1)", hint: "Always belongs to a parent" },
]

function levelLabel(level: number) {
  return LEVELS.find((candidate) => candidate.value === level)?.label ?? `Level ${level}`
}

/**
 * The issue-type catalog.
 *
 * ⚠️ **The hierarchy level is the field that carries meaning**, in the same way a status's category is.
 * It decides what may be a parent of what and what a sprint may plan — so moving a type between levels
 * invalidates hierarchies that are legal today. Reported before Save, and never repaired: which end of
 * a pair was wrong is a judgement about somebody's work.
 */
export function IssueTypesSection({ canAdminister }: { canAdminister: boolean }) {
  const [editing, setEditing] = useState<IssueTypeResponse | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: configuration, refetch } = useQuery({ queryKey: ["configuration"], queryFn: fetchConfiguration })
  const { data: counts } = useQuery({ queryKey: ["administration", "counts"], queryFn: fetchConfigurationCounts })

  const issueTypes = configuration?.issueTypes ?? []
  const schemes = configuration?.issueTypeSchemes ?? []

  /** Which schemes grant a type — as an item, or by preselecting it. */
  function schemesGranting(issueTypeId: string) {
    return schemes
      .filter(
        (scheme) => scheme.issueTypeIds.includes(issueTypeId) || scheme.defaultIssueTypeId === issueTypeId,
      )
      .map((scheme) => scheme.name)
  }

  return (
    <AdministrationSection
      title="Issue types"
      description="The kinds of work this installation tracks. A project sees the ones its issue-type scheme grants, never the whole catalog."
      actions={
        canAdminister && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New issue type
          </Button>
        )
      }
    >
      {!canAdminister && <ReadOnlyNotice />}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead className="w-40">Level</TableHead>
            <TableHead>Granted by schemes</TableHead>
            <TableHead className="w-24">Issues</TableHead>
            {canAdminister && <TableHead className="w-32" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {issueTypes.map((issueType) => {
            const granting = schemesGranting(issueType.id)

            return (
              <TableRow key={issueType.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <IssueTypeIcon type={issueType} />
                    {issueType.name}
                  </span>
                  {issueType.description && (
                    <p className="text-xs text-muted-foreground">{issueType.description}</p>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {levelLabel(issueType.hierarchyLevel)}
                </TableCell>
                <TableCell>
                  {granting.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No scheme — no project can raise one yet
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {granting.map((schemeName) => (
                        <Badge key={schemeName} variant="outline">
                          {schemeName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{counts?.issuesByIssueType[issueType.id] ?? 0}</TableCell>
                {canAdminister && (
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(issueType)}>
                        Edit
                      </Button>
                      <DeleteWithUsage
                        name={issueType.name}
                        noun="issue type"
                        usageQueryKey={["administration", "issue-type-usage", issueType.id]}
                        fetchUsage={() => fetchIssueTypeUsage(issueType.id)}
                        onDelete={() => deleteIssueType(issueType.id)}
                        onDeleted={() => void refetch()}
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {creating && <IssueTypeDialog onClose={() => setCreating(false)} onSaved={() => void refetch()} />}
      {editing && (
        <IssueTypeDialog
          issueType={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void refetch()}
        />
      )}
    </AdministrationSection>
  )
}

const NO_ICON = "__none__"

function IssueTypeDialog({
  issueType,
  onClose,
  onSaved,
}: {
  issueType?: IssueTypeResponse
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(issueType?.name ?? "")
  const [hierarchyLevel, setHierarchyLevel] = useState(issueType?.hierarchyLevel ?? 0)
  const [iconKey, setIconKey] = useState(issueType?.iconKey ?? NO_ICON)
  const [description, setDescription] = useState(issueType?.description ?? "")

  // ⚠️ The picker is built from the server's list rather than from a literal here, so it cannot offer
  // a key the server would refuse — and a key the client cannot draw shows up as the generic fallback
  // in the picker itself rather than as a type that quietly looks like every other one.
  const { data: icons = [] } = useQuery({
    queryKey: ["administration", "issue-type-icons"],
    queryFn: fetchIssueTypeIcons,
  })

  const save = useCatalogMutation({
    mutationFn: () => {
      const request = {
        name: name.trim(),
        hierarchyLevel,
        iconKey: iconKey === NO_ICON ? null : iconKey,
        description: description.trim().length > 0 ? description.trim() : null,
      }

      return issueType ? updateIssueType(issueType.id, request) : createIssueType(request)
    },
    success: issueType ? "Issue type updated" : "Issue type created",
    failure: "Could not save the issue type",
    onDone: () => {
      onSaved()
      onClose()
    },
  })

  return (
    <CatalogDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
      title={issueType ? `Edit ${issueType.name}` : "New issue type"}
      description="Issue types are shared. A project sees the ones its scheme grants, so a new type reaches nobody until a scheme includes it."
      submitLabel={issueType ? "Save" : "Create"}
      canSubmit={name.trim().length > 0}
      isPending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="issue-type-name">Name</Label>
        <Input
          id="issue-type-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="issue-type-level">Level</Label>
        <Select value={String(hierarchyLevel)} onValueChange={(value) => setHierarchyLevel(Number(value))}>
          <SelectTrigger id="issue-type-level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label} — {option.hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">A parent must always sit strictly higher than its child.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="issue-type-icon">Icon</Label>
        <Select value={iconKey} onValueChange={setIconKey}>
          <SelectTrigger id="issue-type-icon">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ICON}>No icon — a generic mark</SelectItem>
            {icons.map((candidate) => (
              <SelectItem key={candidate} value={candidate}>
                <span className="inline-flex items-center gap-1.5">
                  <IssueTypeIcon
                    type={{ id: candidate, name: candidate, hierarchyLevel: 0, iconKey: candidate }}
                  />
                  {candidate}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="issue-type-description">Description</Label>
        <Input
          id="issue-type-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={255}
        />
      </div>

      {issueType && <RenameWarning currentName={issueType.name} nextName={name} />}
      {issueType && hierarchyLevel !== issueType.hierarchyLevel && (
        <LevelChangeImpact issueTypeId={issueType.id} hierarchyLevel={hierarchyLevel} />
      )}
    </CatalogDialog>
  )
}

/** Which existing hierarchies a proposed level would invalidate — reported, never repaired. */
function LevelChangeImpact({ issueTypeId, hierarchyLevel }: { issueTypeId: string; hierarchyLevel: number }) {
  const { data: impact } = useQuery({
    queryKey: ["administration", "issue-type-level-impact", issueTypeId, hierarchyLevel],
    queryFn: () => fetchIssueTypeLevelImpact(issueTypeId, hierarchyLevel),
  })

  if (!impact) {
    return null
  }

  const clean = impact.violatingPairs.length === 0 && impact.issuesInSprints === 0

  return (
    <Alert>
      <AlertTriangle className="size-4" />
      <AlertTitle>
        {clean ? "Nothing existing would be invalidated" : "This would invalidate existing work"}
      </AlertTitle>
      <AlertDescription className="space-y-1.5">
        {impact.violatingPairs.length > 0 && (
          <>
            <p>
              A parent must sit strictly higher than its child. These pairings exist today and would stop
              satisfying that — nothing is rewritten, they simply become inconsistent:
            </p>
            <ul className="space-y-0.5">
              {impact.violatingPairs.map((pair) => (
                <li key={`${pair.parentIssueTypeId}-${pair.childIssueTypeId}`} className="text-xs">
                  <span className="font-medium">
                    {pair.parentIssueTypeName} ({pair.parentLevel}) → {pair.childIssueTypeName} (
                    {pair.childLevel})
                  </span>{" "}
                  <span className="text-muted-foreground">— {pair.count} issue(s)</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {impact.issuesInSprints > 0 && (
          <p className="font-medium">
            {impact.issuesInSprints} issue(s) of this type are committed to a sprint. Only level 0 is what
            a sprint plans, so they would be sitting in sprints that can no longer plan them.
          </p>
        )}

        {clean && <p>No parent/child pairing of this type exists yet.</p>}
      </AlertDescription>
    </Alert>
  )
}

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AdministrationSection,
  CatalogDialog,
  DeleteWithUsage,
  ReadOnlyNotice,
  RenameWarning,
  useCatalogMutation,
} from "@/components/administration/AdministrationPieces"
import {
  createLinkType,
  deleteLinkType,
  fetchConfigurationCounts,
  fetchLinkTypeUsage,
  listLinkTypes,
  updateLinkType,
  type LinkTypeResponse,
} from "@/api/configurationAdministration"

/**
 * The link-type catalog.
 *
 * ⚠️ **The only catalog with no last-row rule.** A link is optional, so an installation with none is
 * coherent: it means nobody links issues, not that something is missing.
 *
 * Both labels are always given, and a symmetric type says the same word twice — the direction is still
 * stored, the labels simply match.
 */
export function LinkTypesSection({ canAdminister }: { canAdminister: boolean }) {
  const [editing, setEditing] = useState<LinkTypeResponse | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: linkTypes = [], refetch } = useQuery({
    queryKey: ["administration", "link-types"],
    queryFn: listLinkTypes,
  })

  const { data: counts } = useQuery({
    queryKey: ["administration", "counts"],
    queryFn: fetchConfigurationCounts,
  })

  return (
    <AdministrationSection
      title="Link types"
      description="The kinds of relationship two issues can have. Each is read one way from the source and the other way from the target."
      actions={
        canAdminister && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New link type
          </Button>
        )
      }
    >
      {!canAdminister && <ReadOnlyNotice />}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Outward</TableHead>
            <TableHead>Inward</TableHead>
            <TableHead className="w-24">Links</TableHead>
            {canAdminister && <TableHead className="w-32" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linkTypes.map((linkType) => (
            <TableRow key={linkType.id}>
              <TableCell className="font-medium">{linkType.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{linkType.outwardLabel}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{linkType.inwardLabel}</TableCell>
              <TableCell className="text-sm">{counts?.linksByLinkType[linkType.id] ?? 0}</TableCell>
              {canAdminister && (
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(linkType)}>
                      Edit
                    </Button>
                    <DeleteWithUsage
                      name={linkType.name}
                      noun="link type"
                      usageQueryKey={["administration", "link-type-usage", linkType.id]}
                      fetchUsage={() => fetchLinkTypeUsage(linkType.id)}
                      onDelete={() => deleteLinkType(linkType.id)}
                      onDeleted={() => void refetch()}
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {creating && <LinkTypeDialog onClose={() => setCreating(false)} onSaved={() => void refetch()} />}
      {editing && (
        <LinkTypeDialog linkType={editing} onClose={() => setEditing(null)} onSaved={() => void refetch()} />
      )}
    </AdministrationSection>
  )
}

function LinkTypeDialog({
  linkType,
  onClose,
  onSaved,
}: {
  linkType?: LinkTypeResponse
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(linkType?.name ?? "")
  const [outwardLabel, setOutwardLabel] = useState(linkType?.outwardLabel ?? "")
  const [inwardLabel, setInwardLabel] = useState(linkType?.inwardLabel ?? "")

  const save = useCatalogMutation({
    mutationFn: () => {
      const request = {
        name: name.trim(),
        outwardLabel: outwardLabel.trim(),
        inwardLabel: inwardLabel.trim(),
      }

      return linkType ? updateLinkType(linkType.id, request) : createLinkType(request)
    },
    success: linkType ? "Link type updated" : "Link type created",
    failure: "Could not save the link type",
    onDone: () => {
      onSaved()
      onClose()
    },
  })

  const canSubmit =
    name.trim().length > 0 && outwardLabel.trim().length > 0 && inwardLabel.trim().length > 0

  return (
    <CatalogDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
      title={linkType ? `Edit ${linkType.name}` : "New link type"}
      description="Both labels are required. For a symmetric type — Relates — write the same words twice."
      submitLabel={linkType ? "Save" : "Create"}
      canSubmit={canSubmit}
      isPending={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="link-type-name">Name</Label>
        <Input
          id="link-type-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Blocks"
          maxLength={64}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="link-type-outward">Outward label</Label>
        <Input
          id="link-type-outward"
          value={outwardLabel}
          onChange={(event) => setOutwardLabel(event.target.value)}
          placeholder="blocks"
          maxLength={64}
        />
        <p className="text-xs text-muted-foreground">How it reads from the issue the link starts at.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="link-type-inward">Inward label</Label>
        <Input
          id="link-type-inward"
          value={inwardLabel}
          onChange={(event) => setInwardLabel(event.target.value)}
          placeholder="is blocked by"
          maxLength={64}
        />
        <p className="text-xs text-muted-foreground">How it reads from the other end.</p>
      </div>

      {linkType && <RenameWarning currentName={linkType.name} nextName={name} />}
    </CatalogDialog>
  )
}

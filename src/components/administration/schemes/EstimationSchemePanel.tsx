import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CatalogDialog,
  DeleteWithUsage,
  useCatalogMutation,
} from "@/components/administration/AdministrationPieces"
import {
  createEstimationScheme,
  deleteEstimationScheme,
  fetchEstimationSchemeUsage,
  updateEstimationScheme,
} from "@/api/configurationAdministration"
import type { EstimationSchemeSummary } from "@/api/projects"

interface EstimationSchemePanelProperties {
  schemes: EstimationSchemeSummary[]
  defaultSchemeId: string | null | undefined
  canAdminister: boolean
}

interface Draft {
  id: string | null
  name: string
  description: string
  items: { label: string; weight: string }[]
}

const BLANK: Draft = { id: null, name: "", description: "", items: [{ label: "", weight: "" }] }

/**
 * How a project estimates — Fibonacci, T-shirt, or a scale somebody builds here.
 *
 * ⚠️ **"Custom" is not a feature; it is what a scheme already is.** An estimation scheme is a catalog
 * entity like every other part of the configuration (ADR-0001), so building a fifth scale is the same
 * create as any other and there is no `CUSTOM` mode anywhere.
 *
 * ⚠️ **Every option is a label and a weight, and the issue stores the weight** (ADR-0019). `XL` weighs
 * `8`, so burndown, velocity and the backlog's sums were untouched by this whole feature — they add
 * numbers, and they always did. The consequence is on the screen: changing a scale rewrites nothing,
 * and an estimate whose weight is no longer on the scale keeps showing as its number.
 *
 * ⚠️ **There is no last-scheme rule here**, unlike the other two kinds. An installation where nobody
 * estimates is coherent; one with no issue-type schemes is a tracker whose next project cannot exist.
 */
export function EstimationSchemePanel({
  schemes,
  defaultSchemeId,
  canAdminister,
}: EstimationSchemePanelProperties) {
  const [draft, setDraft] = useState<Draft | null>(null)

  const save = useCatalogMutation({
    mutationFn: () =>
      draft?.id ? updateEstimationScheme(draft.id, request(draft)) : createEstimationScheme(request(draft!)),
    success: "Scale saved",
    failure: "Could not save the scale",
    onDone: () => setDraft(null),
  })

  const canSubmit =
    Boolean(draft) &&
    draft!.name.trim().length > 0 &&
    draft!.items.length > 0 &&
    draft!.items.every((item) => item.label.trim().length > 0 && Number.isFinite(Number(item.weight)))

  function change(index: number, patch: Partial<{ label: string; weight: string }>) {
    setDraft({
      ...draft!,
      items: draft!.items.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    })
  }

  function move(index: number, by: number) {
    const target = index + by

    if (target < 0 || target >= draft!.items.length) {
      return
    }

    const items = [...draft!.items]
    const [moved] = items.splice(index, 1)
    items.splice(target, 0, moved)
    setDraft({ ...draft!, items })
  }

  return (
    <section className="space-y-2">
      <header className="flex items-end justify-between gap-3">
        <h3 className="text-sm font-medium">Estimation scales</h3>
        {canAdminister && (
          <Button size="sm" variant="outline" onClick={() => setDraft(BLANK)}>
            New scale
          </Button>
        )}
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scale</TableHead>
            <TableHead>Options — and what each counts as</TableHead>
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
                  {scheme.items.map((item) => (
                    <Badge key={item.label} variant="outline" title={`Stored as ${item.weight}`}>
                      {item.label}
                      {item.label !== String(item.weight) && (
                        <span className="ml-1 text-muted-foreground">= {item.weight}</span>
                      )}
                    </Badge>
                  ))}
                </div>
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
                          items: scheme.items.map((item) => ({
                            label: item.label,
                            weight: String(item.weight),
                          })),
                        })
                      }
                    >
                      Edit
                    </Button>
                    <DeleteWithUsage
                      name={scheme.name}
                      noun="scale"
                      usageQueryKey={["administration", "estimation-scheme-usage", scheme.id]}
                      fetchUsage={() => fetchEstimationSchemeUsage(scheme.id)}
                      onDelete={() => deleteEstimationScheme(scheme.id)}
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
        title={draft?.id ? "Edit scale" : "New estimation scale"}
        description="Each option is what a person picks and what it counts as. The number is what the issue stores, so every total keeps adding up the same way."
        submitLabel="Save scale"
        canSubmit={canSubmit}
        isPending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        {draft && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="estimation-name">Name</Label>
                <Input
                  id="estimation-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estimation-description">Description</Label>
                <Input
                  id="estimation-description"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Options</Label>

              <ul className="space-y-1.5">
                {draft.items.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Input
                      aria-label="Label"
                      placeholder="XL"
                      className="flex-1"
                      value={item.label}
                      onChange={(event) => change(index, { label: event.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">counts as</span>
                    <Input
                      aria-label="Weight"
                      type="number"
                      step="0.5"
                      placeholder="8"
                      className="w-24"
                      value={item.weight}
                      onChange={(event) => change(index, { weight: event.target.value })}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Move down"
                      disabled={index === draft.items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Remove option"
                      disabled={draft.items.length === 1}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          items: draft.items.filter((_entry, position) => position !== index),
                        })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraft({ ...draft, items: [...draft.items, { label: "", weight: "" }] })}
              >
                <Plus className="size-3.5" />
                Add option
              </Button>

              <p className="text-xs text-muted-foreground">
                Labels have to differ; weights may repeat. Changing a scale rewrites no estimate — an
                issue whose number is no longer an option here keeps showing that number.
              </p>
            </div>
          </>
        )}
      </CatalogDialog>
    </section>
  )
}

function request(draft: Draft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    items: draft.items.map((item) => ({ label: item.label.trim(), weight: Number(item.weight) })),
  }
}

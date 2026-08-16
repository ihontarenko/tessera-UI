import { useEffect, useMemo, useState } from "react"
import { Check, Globe, Loader2, MapPin, Plus, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAgentGrants, useReplaceAgentGrants } from "@/hooks/useAiAdministration"
import type { AgentOffer, AgentPlacement, AgentSurface } from "@/api/ai"
import { cn } from "@/lib/helpers"

/**
 * What a restricted agent holds — the pane the *Restrict it* button used to have no answer for.
 *
 * ⚠️ **The same editor exists in the other product, over the same routes, and looks the same.** Three
 * axes cross the port as opaque strings — permissions, places, roles — so neither this component nor the
 * library it talks to knows that a place is a project here and a workspace there.
 *
 * ⚠️ **Offered rather than free-typed, and the offer is the owner's set.** An agent's grants are
 * intersected with its owner's on every request, so a permission the owner does not hold resolves to
 * nothing and reads, from outside, exactly like the agent being broken. A form that let somebody type
 * one would be a form that hides the rule.
 *
 * ⚠️ **Saved as a whole set, and only on the button.** Toggling a chip changes a draft; nothing reaches
 * the server until *Save*, so a half-built set is never briefly in force.
 */
export function AgentGrantsEditor({
  surface,
  agentId,
  expanded,
}: {
  surface: AgentSurface
  agentId: string
  expanded: boolean
}) {
  const grants = useAgentGrants(surface, agentId, expanded)
  const save = useReplaceAgentGrants(surface, agentId)

  const [permissions, setPermissions] = useState<string[]>([])
  const [placements, setPlacements] = useState<AgentPlacement[]>([])

  const held = grants.data?.held

  // Re-seeded whenever the server's answer changes — which includes a save's own response, so the
  // draft and what is in force cannot drift apart after one.
  useEffect(() => {
    if (held) {
      setPermissions(held.permissions)
      setPlacements(held.placements)
    }
  }, [held])

  const dirty = useMemo(() => {
    if (!held) {
      return false
    }

    return (
      !sameSet(held.permissions, permissions) ||
      !sameSet(held.placements.map(describePlacement), placements.map(describePlacement))
    )
  }, [held, permissions, placements])

  function togglePermission(permission: string) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((chosen) => chosen !== permission)
        : [...current, permission],
    )
  }

  function undo() {
    setPermissions(held?.permissions ?? [])
    setPlacements(held?.placements ?? [])
  }

  if (!expanded) {
    return null
  }

  if (grants.isLoading) {
    return <Skeleton className="h-32 w-full" />
  }

  if (!grants.data) {
    return null
  }

  const { offer } = grants.data

  if (offer.permissions.length === 0 && offer.roles.length === 0) {
    return (
      <Alert>
        <AlertTitle>Its owner holds nothing to hand down</AlertTitle>
        <AlertDescription>
          A restricted agent can never hold more than the account it acts for. Give that account
          something first, or let this one act with its owner's access instead.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-3">
      <PermissionChips
        offered={offer.permissions}
        chosen={permissions}
        onToggle={togglePermission}
      />

      <PlacementEditor offer={offer} placements={placements} onChange={setPlacements} />

      <div className="flex items-center justify-end gap-2 border-t pt-3">
        {dirty && (
          <span className="mr-auto text-xs text-muted-foreground">
            Unsaved — it applies from the agent's next call.
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={!dirty || save.isPending}
          onClick={undo}
        >
          Undo
        </Button>
        <Button
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ permissions, placements })}
        >
          {save.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  )
}

/** ⚠️ Chips rather than checkboxes: forty permissions as a checkbox list is a page, not a pane. */
function PermissionChips({
  offered,
  chosen,
  onToggle,
}: {
  offered: string[]
  chosen: string[]
  onToggle: (permission: string) => void
}) {
  if (offered.length === 0) {
    return null
  }

  return (
    <section className="space-y-2">
      <SectionHeading
        title="What it may do"
        note={`${chosen.length} of ${offered.length} its owner can hand down`}
      />

      <div className="flex flex-wrap gap-1.5">
        {offered.map((permission) => {
          const on = chosen.includes(permission)

          return (
            <button
              key={permission}
              type="button"
              onClick={() => onToggle(permission)}
              className={cn(
                "inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                on
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {on ? <Check className="size-3 text-primary" /> : <Plus className="size-3 opacity-50" />}
              {permission}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * As what, and where.
 *
 * ⚠️ **A place-scoped role cannot be added without a place, and an installation-wide one cannot be
 * given one.** Both mistakes are refused here rather than corrected: one is a widening nobody asked
 * for, the other confers nothing where the person expected everything.
 */
function PlacementEditor({
  offer,
  placements,
  onChange,
}: {
  offer: AgentOffer
  placements: AgentPlacement[]
  onChange: (placements: AgentPlacement[]) => void
}) {
  const [roleName, setRoleName] = useState("")
  const [placeId, setPlaceId] = useState("")

  if (offer.roles.length === 0) {
    return null
  }

  const role = offer.roles.find((offered) => offered.name === roleName)
  const needsPlace = role?.placeScoped ?? false
  const complete = role !== undefined && (!needsPlace || placeId !== "")

  function add() {
    if (!complete) {
      return
    }

    const wanted: AgentPlacement = { roleName, placeId: needsPlace ? placeId : null }

    if (!placements.some((held) => describePlacement(held) === describePlacement(wanted))) {
      onChange([...placements, wanted])
    }

    setRoleName("")
    setPlaceId("")
  }

  return (
    <section className="space-y-2">
      <SectionHeading title="Where it acts, and as what" note={`${placements.length} placed`} />

      {placements.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {placements.map((placement) => (
            <span
              key={describePlacement(placement)}
              className="inline-flex items-center gap-1.5 rounded border bg-background px-2 py-0.5 text-[11px]"
            >
              {placement.placeId === null ? (
                <Globe className="size-3 text-muted-foreground" />
              ) : (
                <MapPin className="size-3 text-primary" />
              )}
              <span className="font-medium">{placement.roleName}</span>
              <span className="text-muted-foreground">
                {placement.placeId === null ? "everywhere" : labelOf(offer, placement.placeId)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${placement.roleName}`}
                className="text-muted-foreground transition-colors hover:text-destructive"
                onClick={() =>
                  onChange(
                    placements.filter(
                      (held) => describePlacement(held) !== describePlacement(placement),
                    ),
                  )
                }
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={roleName} onValueChange={setRoleName}>
          <SelectTrigger size="sm" className="w-[190px] text-xs">
            <SelectValue placeholder="Add a role…" />
          </SelectTrigger>
          <SelectContent>
            {offer.roles.map((offered) => (
              <SelectItem key={offered.name} value={offered.name} className="text-xs">
                {offered.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {needsPlace && (
          <Select value={placeId} onValueChange={setPlaceId}>
            <SelectTrigger size="sm" className="w-[220px] text-xs">
              <SelectValue placeholder="…in which place?" />
            </SelectTrigger>
            <SelectContent>
              {offer.places.map((place) => (
                <SelectItem key={place.id} value={place.id} className="text-xs">
                  {place.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button size="sm" variant="outline" disabled={!complete} onClick={add}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {needsPlace && offer.places.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Its owner cannot reach anywhere this role would mean something, so there is nothing to place
          it in.
        </p>
      )}
    </section>
  )
}

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h4 className="text-xs font-medium">{title}</h4>
      <span className="text-[11px] text-muted-foreground">{note}</span>
    </div>
  )
}

function labelOf(offer: AgentOffer, placeId: string) {
  return offer.places.find((place) => place.id === placeId)?.label ?? placeId
}

/** ⚠️ A stable key for a pair, since a placement is compared by value and not by identity. */
function describePlacement(placement: AgentPlacement) {
  return `${placement.roleName}@${placement.placeId ?? ""}`
}

/** ⚠️ Order-insensitive: a chip toggled off and back on must not read as a change. */
function sameSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  const ordered = [...right].sort()

  return [...left].sort().every((entry, at) => entry === ordered[at])
}

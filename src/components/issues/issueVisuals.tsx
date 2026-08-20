import type { CSSProperties, ReactNode } from "react"
import {
  BadgeCheck,
  Bandage,
  Bookmark,
  Brush,
  Bug,
  CheckSquare,
  ChevronsUp,
  CircleHelp,
  Compass,
  Eraser,
  FileText,
  Flag,
  Flame,
  LifeBuoy,
  Layers,
  ListChecks,
  Microscope,
  Rocket,
  ShieldAlert,
  Sparkles,
  SquareStack,
  TrendingUp,
  Waypoints,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { IssueTypeSummary, PrioritySummary, StatusCategory, StatusSummary } from "@/api/issues"
import { cn } from "@/lib/helpers"
import { estimationLabel } from "@/lib/estimation"
import type { EstimationSchemeSummary } from "@/api/projects"

/**
 * The drawing for each issue-type icon key.
 *
 * ⚠️ **This map and `IssueTypeIcons.ALL` on the server are two halves of one list**, and they have to
 * agree: the server refuses a key it does not know, and a key it allows that is missing here draws the
 * generic fallback — which is an invisible typo, since a type with the wrong icon looks exactly like a
 * type with the right one. Adding an icon is both edits. The Administration picker is built from the
 * server's list and renders each option through `IssueTypeIcon`, so a mismatch is visible there
 * immediately rather than after somebody creates a type.
 *
 * The keys name what a type *is*, never what it looks like — `incident`, not `siren` — so that
 * changing the drawing later is a change to this file and to nothing else.
 */
const TYPE_ICONS: Record<string, LucideIcon> = {
  // The seeded five.
  epic: Layers,
  story: Bookmark,
  task: CheckSquare,
  bug: Bug,
  "sub-task": SquareStack,
  // Wider containers.
  initiative: Rocket,
  milestone: Flag,
  // ⚠️ Spokes meeting at a centre, not a stack: a hub gathers work it does not contain.
  hub: Waypoints,
  // Kinds of work a team distinguishes.
  improvement: TrendingUp,
  feature: Sparkles,
  spike: Compass,
  chore: Wrench,
  documentation: FileText,
  design: Brush,
  research: Microscope,
  // Things that arrive rather than get planned.
  incident: Flame,
  support: LifeBuoy,
  question: CircleHelp,
  risk: ShieldAlert,
  security: BadgeCheck,
  debt: ListChecks,
  // The two smallest, which are neither planned nor arriving — they are noticed. A bandage for the
  // thing that is a small injury, an eraser for the thing that just needed rubbing out.
  papercut: Bandage,
  nit: Eraser,
}

/**
 * The hue each issue type is drawn in — as the icon's text colour and as the accent edge a board card
 * wears (TSSR-22), so the two can never disagree about what a bug looks like.
 *
 * ⚠️ **Both class names are written out in full, and cannot become a template.** Tailwind builds its
 * stylesheet by scanning source for whole class names, so `` `border-l-${hue}-500` `` compiles to no CSS
 * at all — the edge simply does not draw, with nothing to see in the markup that says why.
 *
 * The border takes the 500 shade rather than the icon's 600/400 pair: an edge is a 4px block of solid
 * colour, not text, so it needs no light/dark split to stay legible on either surface.
 */
const TYPE_COLORS: Record<string, { text: string; border: string }> = {
  epic: { text: "text-violet-600 dark:text-violet-400", border: "border-l-violet-500" },
  story: { text: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
  task: { text: "text-sky-600 dark:text-sky-400", border: "border-l-sky-500" },
  bug: { text: "text-rose-600 dark:text-rose-400", border: "border-l-rose-500" },
  "sub-task": { text: "text-slate-500 dark:text-slate-400", border: "border-l-slate-400" },
  initiative: { text: "text-violet-600 dark:text-violet-400", border: "border-l-violet-500" },
  milestone: { text: "text-amber-600 dark:text-amber-400", border: "border-l-amber-500" },
  hub: { text: "text-indigo-600 dark:text-indigo-400", border: "border-l-indigo-500" },
  improvement: { text: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
  feature: { text: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-l-fuchsia-500" },
  spike: { text: "text-cyan-600 dark:text-cyan-400", border: "border-l-cyan-500" },
  chore: { text: "text-slate-500 dark:text-slate-400", border: "border-l-slate-400" },
  documentation: { text: "text-blue-600 dark:text-blue-400", border: "border-l-blue-500" },
  design: { text: "text-pink-600 dark:text-pink-400", border: "border-l-pink-500" },
  research: { text: "text-teal-600 dark:text-teal-400", border: "border-l-teal-500" },
  incident: { text: "text-red-600 dark:text-red-400", border: "border-l-red-500" },
  support: { text: "text-orange-600 dark:text-orange-400", border: "border-l-orange-500" },
  question: { text: "text-indigo-600 dark:text-indigo-400", border: "border-l-indigo-500" },
  risk: { text: "text-amber-600 dark:text-amber-400", border: "border-l-amber-500" },
  security: { text: "text-lime-600 dark:text-lime-400", border: "border-l-lime-500" },
  debt: { text: "text-stone-500 dark:text-stone-400", border: "border-l-stone-400" },
  papercut: { text: "text-yellow-600 dark:text-yellow-400", border: "border-l-yellow-500" },
  // Grey on purpose: a nit is the quiet one, and it should not compete for attention on a board.
  nit: { text: "text-zinc-500 dark:text-zinc-400", border: "border-l-zinc-400" },
}

export function IssueTypeIcon({ type, className }: { type: IssueTypeSummary | null; className?: string }) {
  const Icon = (type?.iconKey && TYPE_ICONS[type.iconKey]) || ListChecks
  const color = (type?.iconKey && TYPE_COLORS[type.iconKey]?.text) || "text-muted-foreground"
  return <Icon className={cn("size-4 shrink-0", color, className)} aria-label={type?.name ?? "Issue"} />
}

/**
 * The accent-edge class for a type, for the surfaces that draw one.
 *
 * ⚠️ **A type this file has never heard of gets a transparent edge, not a grey one.** A grey stripe
 * reads as a type whose colour happens to be grey — an answer — where transparent reads as no answer,
 * which is the truth. The icon's own fallback says the same thing the same way.
 */
export function issueTypeBorderClass(type: IssueTypeSummary | null): string {
  return (type?.iconKey && TYPE_COLORS[type.iconKey]?.border) || "border-l-transparent"
}

export function IssueTypeLabel({ type }: { type: IssueTypeSummary | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <IssueTypeIcon type={type} />
      <span className="text-sm">{type?.name ?? "—"}</span>
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: PrioritySummary | null }) {
  if (!priority) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <ChevronsUp className="size-3.5" style={{ color: priority.color ?? undefined }} />
      {priority.name}
    </span>
  )
}

/**
 * What a status looks like when it has not been given a colour of its own.
 *
 * ⚠️ **The fallback, not the rule.** Two statuses in one category are drawn identically here — which is
 * exactly why a status may carry its own colour (TSSR-21). This map is what the four seeded statuses
 * still look like, and what any status looks like until somebody picks something.
 */
const CATEGORY_STYLES: Record<StatusCategory, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  DONE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
}

const PILL_SHAPE = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide"

/**
 * The class and inline custom property that draw a status in its own colour.
 *
 * ⚠️ **The stored colour is the accent, never the text.** A pill is a filled element, and a mid-tone hex
 * printed straight onto a near-black surface is unreadable — which is precisely what the category
 * fallback's hand-written `text-sky-700 dark:text-sky-300` pairing exists to avoid. `.status-pill-custom`
 * in `index.css` mixes one stored value towards black in light and towards white in dark, reproducing
 * that pairing from a single hex and keeping it working across all 27 themes.
 *
 * Exported because a status pill is drawn in one other place with its own markup — the wiki's live
 * blocks — and a second copy of this arithmetic is a second thing to keep in step.
 */
export function statusColorStyle(color: string | null | undefined): {
  className: string
  style: CSSProperties | undefined
} {
  if (!color) {
    return { className: "", style: undefined }
  }

  return { className: "status-pill-custom", style: { "--status-color": color } as CSSProperties }
}

export function StatusPill({ status, children }: { status: StatusSummary | null; children?: ReactNode }) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>
  }

  const custom = statusColorStyle(status.color)

  return (
    <span
      className={cn(PILL_SHAPE, custom.className || CATEGORY_STYLES[status.category])}
      style={custom.style}
    >
      {status.name}
      {children}
    </span>
  )
}

/** Story points as a compact string, or an em dash when unset. */
/**
 * An estimate as a person reads it.
 *
 * ⚠️ **Given the project's scale it prints the label; without one it prints the number.** An
 * estimate is stored as a weight (ADR-0019), so `8` is what a T-shirt team's `XL` looks like in the
 * column — and a list that shows the number while the issue's own rail shows the word is a list
 * nobody trusts. The resolution itself lives in `lib/estimation` and only there.
 */
export function formatStoryPoints(
  storyPoints: number | null | undefined,
  scheme?: EstimationSchemeSummary | null,
): string {
  return estimationLabel(storyPoints, scheme)
}

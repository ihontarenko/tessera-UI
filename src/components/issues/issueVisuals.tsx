import type { ReactNode } from "react"
import {
  BadgeCheck,
  Bookmark,
  Brush,
  Bug,
  CheckSquare,
  ChevronsUp,
  CircleHelp,
  Compass,
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
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { IssueTypeSummary, PrioritySummary, StatusCategory, StatusSummary } from "@/api/issues"
import { cn } from "@/lib/helpers"

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
}

const TYPE_COLORS: Record<string, string> = {
  epic: "text-violet-600 dark:text-violet-400",
  story: "text-emerald-600 dark:text-emerald-400",
  task: "text-sky-600 dark:text-sky-400",
  bug: "text-rose-600 dark:text-rose-400",
  "sub-task": "text-slate-500 dark:text-slate-400",
  initiative: "text-violet-600 dark:text-violet-400",
  milestone: "text-amber-600 dark:text-amber-400",
  improvement: "text-emerald-600 dark:text-emerald-400",
  feature: "text-fuchsia-600 dark:text-fuchsia-400",
  spike: "text-cyan-600 dark:text-cyan-400",
  chore: "text-slate-500 dark:text-slate-400",
  documentation: "text-blue-600 dark:text-blue-400",
  design: "text-pink-600 dark:text-pink-400",
  research: "text-teal-600 dark:text-teal-400",
  incident: "text-red-600 dark:text-red-400",
  support: "text-orange-600 dark:text-orange-400",
  question: "text-indigo-600 dark:text-indigo-400",
  risk: "text-amber-600 dark:text-amber-400",
  security: "text-lime-600 dark:text-lime-400",
  debt: "text-stone-500 dark:text-stone-400",
}

export function IssueTypeIcon({ type, className }: { type: IssueTypeSummary | null; className?: string }) {
  const Icon = (type?.iconKey && TYPE_ICONS[type.iconKey]) || ListChecks
  const color = (type?.iconKey && TYPE_COLORS[type.iconKey]) || "text-muted-foreground"
  return <Icon className={cn("size-4 shrink-0", color, className)} aria-label={type?.name ?? "Issue"} />
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

const CATEGORY_STYLES: Record<StatusCategory, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  DONE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
}

export function StatusPill({ status, children }: { status: StatusSummary | null; children?: ReactNode }) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        CATEGORY_STYLES[status.category],
      )}
    >
      {status.name}
      {children}
    </span>
  )
}

/** Story points as a compact string, or an em dash when unset. */
export function formatStoryPoints(storyPoints: number | null | undefined): string {
  if (storyPoints === null || storyPoints === undefined) {
    return "—"
  }
  return String(storyPoints)
}

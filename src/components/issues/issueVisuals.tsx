import type { ReactNode } from "react"
import { Bookmark, Bug, CheckSquare, ChevronsUp, Layers, ListChecks, SquareStack } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { IssueTypeSummary, PrioritySummary, StatusCategory, StatusSummary } from "@/api/issues"
import { cn } from "@/lib/helpers"

// Icon per seeded issue-type key (falls back to a generic checkbox for unknown/custom types).
const TYPE_ICONS: Record<string, LucideIcon> = {
  epic: Layers,
  story: Bookmark,
  task: CheckSquare,
  bug: Bug,
  "sub-task": SquareStack,
}

const TYPE_COLORS: Record<string, string> = {
  epic: "text-violet-600 dark:text-violet-400",
  story: "text-emerald-600 dark:text-emerald-400",
  task: "text-sky-600 dark:text-sky-400",
  bug: "text-rose-600 dark:text-rose-400",
  "sub-task": "text-slate-500 dark:text-slate-400",
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

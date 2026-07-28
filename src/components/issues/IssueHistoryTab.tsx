import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { listHistory } from "@/api/issues"

// Stable field keys → human labels (the backend records the key; the UI localizes it — ADR-0007).
const FIELD_LABELS: Record<string, string> = {
  created: "Created",
  summary: "Summary",
  description: "Description",
  type: "Type",
  priority: "Priority",
  assignee: "Assignee",
  storyPoints: "Story points",
  status: "Status",
  resolution: "Resolution",
  parent: "Parent",
  labels: "Labels",
  components: "Components",
  affectsVersions: "Affects versions",
  fixVersions: "Fix versions",
  link: "Link",
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString()
}

/** The History tab (ticket 08): change events newest-first, each grouping its per-field items with
 *  the point-in-time before/after values the mutation recorded. */
export function IssueHistoryTab({ issueId }: { issueId: string }) {
  const { data: events, isLoading } = useQuery({ queryKey: ["history", issueId], queryFn: () => listHistory(issueId) })

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />
  }

  if (events && events.length === 0) {
    return <EmptyState icon={History} title="No history yet" message="Field changes will appear here as they happen." />
  }

  return (
    <ol className="space-y-4">
      {events?.map((event) => (
        <li key={event.id} className="rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <MemberChip member={event.actor} />
            <span className="text-xs text-muted-foreground">{formatTimestamp(event.createdAt)}</span>
          </div>
          <ul className="mt-2 space-y-1">
            {event.items.map((item, index) => (
              <li key={index} className="text-sm">
                <span className="font-medium">{fieldLabel(item.field)}</span>{" "}
                {item.field === "created" ? (
                  <span className="text-muted-foreground">{item.newValue}</span>
                ) : (
                  <span className="text-muted-foreground">
                    <span className="line-through opacity-70">{item.oldValue ?? "—"}</span>
                    {" → "}
                    <span className="text-foreground">{item.newValue ?? "—"}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

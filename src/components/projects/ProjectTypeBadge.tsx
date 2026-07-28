import { Badge } from "@/components/ui/badge"
import type { ProjectType } from "@/api/projects"

const TYPE_LABELS: Record<ProjectType, string> = {
  SCRUM: "Scrum",
  KANBAN: "Kanban",
  TODO: "Todo",
}

export function ProjectTypeBadge({ type }: { type: ProjectType }) {
  return <Badge variant="outline">{TYPE_LABELS[type]}</Badge>
}

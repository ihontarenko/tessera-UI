import { Badge } from "@jmouse/ui"
import type { BoardScopeStrategy } from "@/api/sprints"
import { projectStyleLabel } from "@/lib/projectStyle"

/** Says Scrum or Kanban, computed from the board's scope strategy — never from a stored type, which
 *  is what used to let the badge contradict the project it labelled (ADR-0015). */
export function ProjectStyleBadge({ boardScopeStrategy }: { boardScopeStrategy: BoardScopeStrategy }) {
  return <Badge variant="outline">{projectStyleLabel(boardScopeStrategy)}</Badge>
}

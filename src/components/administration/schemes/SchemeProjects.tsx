import { Link } from "react-router-dom"
import { Badge } from "@jmouse/ui"
import type { ProjectReference } from "@/api/configurationAdministration"

/**
 * Whose work a scheme decides, by key and as links.
 *
 * ⚠️ **On the row permanently, not inside a confirmation.** Editing a scheme is editing every project on
 * it, and a dialog that says so once Delete is pressed says it after the decision was made. A key is
 * what somebody recognises and what they paste; the link is so "which projects?" is one click, not a
 * search.
 */
export function SchemeProjects({ projects }: { projects: ProjectReference[] }) {
  if (projects.length === 0) {
    return <span className="text-xs text-muted-foreground">No project uses it</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {projects.map((project) => (
        <Link key={project.id} to={`/projects/${project.id}`} title={project.name}>
          <Badge variant="secondary" className="font-mono text-[11px] hover:bg-secondary/70">
            {project.key}
          </Badge>
        </Link>
      ))}
    </div>
  )
}

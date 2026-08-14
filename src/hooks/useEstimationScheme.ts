import { useQuery } from "@tanstack/react-query"
import { getProject } from "@/api/projects"

/**
 * The scale this project estimates on, or null where it does not.
 *
 * ⚠️ **The project is the only place this answer lives.** An estimate is stored as a weight (ADR-0019),
 * so a screen showing one needs the project's `(label, weight)` pairs to render `8` as `XL` and to
 * offer the picker — and the three screens that show one (the issue rail, the backlog row, the create
 * dialog) each reach it from a different direction. A hook is cheaper than threading the scheme through
 * three component trees, and the query is the one every project screen already has open.
 *
 * ⚠️ **`undefined` while loading, `null` for "does not estimate"** — the controls render nothing for
 * both, which is the right answer in both cases.
 */
export function useEstimationScheme(projectId: string | null | undefined) {
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
  })

  return project?.estimationScheme ?? null
}

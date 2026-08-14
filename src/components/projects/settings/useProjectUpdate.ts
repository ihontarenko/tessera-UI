import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { updateProject, type ProjectResponse, type UpdateProjectRequest } from "@/api/projects"
import { apiErrorMessage } from "@/api/errors"

/**
 * Save one project setting.
 *
 * `PUT /api/projects/{id}` takes the whole editable project — name, lead and every scheme — while
 * Settings is now several sections each owning one of them (ticket 06). Rather than have every section
 * remember to resend the three fields it is not editing, they pass only what they changed and this fills
 * the rest from the project as last read. One place knows the endpoint's shape, so a section cannot
 * blank a field by forgetting it.
 */
export function useProjectUpdate(project: ProjectResponse, successMessage: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (changes: Partial<UpdateProjectRequest>) =>
      updateProject(project.id, {
        name: project.name,
        leadMemberId: project.lead?.id ?? "",
        issueTypeSchemeId: project.issueTypeScheme?.id ?? "",
        workflowSchemeId: project.workflowScheme?.id ?? "",
        // ⚠️ Null is a value here, not a missing one — `?? ""` would turn "does not estimate"
        // into a scheme id of "" and refuse on the next save from any other section.
        estimationSchemeId: project.estimationScheme?.id ?? null,
        keyStrategy: project.keyStrategy,
        keyPattern: project.keyPattern,
        ...changes,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["project", project.id], updated)
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
      toast.success(successMessage)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update the project")),
  })
}

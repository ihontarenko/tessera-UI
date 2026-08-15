import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiErrorMessage } from "@/api/errors"
import {
  createProviderConfiguration,
  discardProviderConfiguration,
  fetchAiOverview,
  fetchProviderConfigurations,
  listPublishedTools,
  listToolCalls,
  listUsageTotals,
  putProviderConfigurationInForce,
  takeProviderConfigurationOutOfForce,
  updateProviderConfiguration,
  type ProviderDraft,
} from "@/api/ai"

/**
 * The AI screen's server state, over `jmouse-ai-management`'s routes.
 *
 * ⚠️ **Every write invalidates three caches, and that is not belt-and-braces.** The overview reports
 * what the settings source actually *resolved*, which is a different question from what the rows say —
 * putting one in force is precisely the moment those two answers change together, and a screen showing
 * the new row beside the old "in force" line would be getting wrong the one thing this page exists to
 * tell apart. The assistant's own availability is the third, so the chat screen starts (or stops)
 * offering a box without a reload.
 */

const OVERVIEW = ["ai", "overview"]
const CONFIGURATIONS = ["ai", "configurations"]
const ASSISTANT = ["assistant", "availability"]

export function useAiOverview() {
  return useQuery({ queryKey: OVERVIEW, queryFn: fetchAiOverview })
}

export function usePublishedTools() {
  return useQuery({
    queryKey: ["ai", "tools"],
    // The catalogue is fixed at startup — it cannot change while somebody is looking at it.
    staleTime: Infinity,
    queryFn: listPublishedTools,
  })
}

export function useToolCalls(parameters: { caller?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ["ai", "calls", parameters],
    queryFn: () => listToolCalls(parameters),
  })
}

export function useUsageTotals() {
  return useQuery({ queryKey: ["ai", "usage"], queryFn: () => listUsageTotals() })
}

export function useProviderConfigurations(enabled: boolean) {
  return useQuery({ queryKey: CONFIGURATIONS, queryFn: fetchProviderConfigurations, enabled })
}

export function useCreateProviderConfiguration() {
  return useProviderMutation({
    mutationFn: (draft: ProviderDraft) => createProviderConfiguration(draft),
    success: "Configuration added — it is idle until you put it in force",
    failure: "Could not add that configuration",
  })
}

export function useUpdateProviderConfiguration() {
  return useProviderMutation({
    mutationFn: ({ id, ...draft }: ProviderDraft & { id: string }) =>
      updateProviderConfiguration(id, draft),
    success: "Configuration saved",
    failure: "Could not save that configuration",
  })
}

export function usePutProviderConfigurationInForce() {
  return useProviderMutation({
    mutationFn: (id: string) => putProviderConfigurationInForce(id),
    success: "That configuration is now in force",
    failure: "Could not put that configuration in force",
  })
}

export function useTakeProviderConfigurationOutOfForce() {
  return useProviderMutation({
    mutationFn: (id: string) => takeProviderConfigurationOutOfForce(id),
    success: "Taken out of force — the assistant is off, the tools are unaffected",
    failure: "Could not take that configuration out of force",
  })
}

export function useDiscardProviderConfiguration() {
  return useProviderMutation({
    mutationFn: (id: string) => discardProviderConfiguration(id),
    success: "Configuration deleted",
    failure: "Could not delete that configuration",
  })
}

/** One place the three caches that move together are named, so a new write cannot forget one. */
function useProviderMutation<TResult, TVariables>({
  mutationFn,
  success,
  failure,
}: {
  mutationFn: (variables: TVariables) => Promise<TResult>
  success: string
  failure: string
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => {
      toast.success(success)
      ;[CONFIGURATIONS, OVERVIEW, ASSISTANT].forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey })
      })
    },
    onError: (error) => toast.error(apiErrorMessage(error, failure)),
  })
}

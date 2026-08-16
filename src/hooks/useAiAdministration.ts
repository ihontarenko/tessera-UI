import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiErrorMessage } from "@/api/errors"
import {
  createProviderConfiguration,
  fetchAgents,
  renameAgent,
  revokeAgentConnection,
  revokeAllAgentConnections,
  setAgentAuthority,
  setAgentEnabled,
  type AgentAuthority,
  type AgentView,
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
  discardAgent,
  fetchAgentGrants,
  replaceAgentGrants,
  type AgentPlacement,
  type AgentSurface,
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

// ── Agents ───────────────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **Keyed by surface, and it has to be.** The two lists overlap — your own agents are also in the
 * installation's — so one key would let the administration screen's answer satisfy the account page's
 * query and show somebody every agent there is on their own settings page.
 */
const AGENTS = (surface: AgentSurface) => ["ai", "agents", surface]

export function useAgents(surface: AgentSurface = "everyone") {
  return useQuery({ queryKey: AGENTS(surface), queryFn: () => fetchAgents(surface) })
}

/**
 * Every agent write, over one helper.
 *
 * ⚠️ **It invalidates only the agents cache**, unlike the provider writes above. Switching an agent off
 * changes nothing about which model is in force or whether the assistant answers — invalidating those
 * too would refetch three things to show one, and make the screen flicker for no reason.
 */
function useAgentMutation<TVariables>({
  surface,
  mutationFn,
  success,
  failure,
}: {
  surface: AgentSurface
  mutationFn: (variables: TVariables) => Promise<AgentView>
  success: string
  failure: string
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => {
      toast.success(success)
      // ⚠️ Both lists, not only the one that was showing. An agent switched off on the account page is
      // switched off on the administration screen too, and a stale tab is how somebody concludes the
      // switch did nothing.
      void queryClient.invalidateQueries({ queryKey: AGENTS(surface) })
      void queryClient.invalidateQueries({
        queryKey: AGENTS(surface === "mine" ? "everyone" : "mine"),
      })
    },
    onError: (error) => toast.error(apiErrorMessage(error, failure)),
  })
}

export function useSetAgentEnabled(surface: AgentSurface = "everyone") {
  return useAgentMutation<{ agentId: string; enabled: boolean }>({
    surface,
    mutationFn: ({ agentId, enabled }) => setAgentEnabled(surface, agentId, enabled),
    success: "Agent updated",
    failure: "Could not change the agent",
  })
}

export function useRenameAgent(surface: AgentSurface = "everyone") {
  return useAgentMutation<{ agentId: string; name: string }>({
    surface,
    mutationFn: ({ agentId, name }) => renameAgent(surface, agentId, name),
    success: "Agent renamed",
    failure: "Could not rename the agent",
  })
}

export function useSetAgentAuthority(surface: AgentSurface = "everyone") {
  return useAgentMutation<{ agentId: string; authority: AgentAuthority }>({
    surface,
    mutationFn: ({ agentId, authority }) => setAgentAuthority(surface, agentId, authority),
    success: "Authority changed — it applies from the next call",
    failure: "Could not change what this agent may do",
  })
}

export function useRevokeAgentConnection(surface: AgentSurface = "everyone") {
  return useAgentMutation<{ agentId: string; connectionId: string }>({
    surface,
    mutationFn: ({ agentId, connectionId }) =>
      revokeAgentConnection(surface, agentId, connectionId),
    success: "Client disconnected",
    failure: "Could not end that client",
  })
}

export function useRevokeAllAgentConnections(surface: AgentSurface = "everyone") {
  return useAgentMutation<string>({
    surface,
    mutationFn: (agentId) => revokeAllAgentConnections(surface, agentId),
    success: "Every client of this agent was disconnected",
    failure: "Could not end those clients",
  })
}

/** ⚠️ Your own only. See {@link discardAgent} for why there is no administrator's counterpart. */
export function useDiscardAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (agentId: string) => discardAgent(agentId),
    onSuccess: () => {
      toast.success("Agent discarded")
      void queryClient.invalidateQueries({ queryKey: AGENTS("mine") })
      void queryClient.invalidateQueries({ queryKey: AGENTS("everyone") })
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not discard that agent")),
  })
}

// ── An agent's own grants ────────────────────────────────────────────────────────────────────────

const GRANTS = (surface: AgentSurface, agentId: string) => ["ai", "agents", surface, agentId, "grants"]

/**
 * What one agent holds, beside what its owner could hand it.
 *
 * ⚠️ **Only asked once the row is expanded.** An installation with twenty agents would otherwise fire
 * twenty requests to fill panes nobody opened — and every one of them resolves the owner's whole
 * effective permission set, which is the expensive half.
 */
export function useAgentGrants(surface: AgentSurface, agentId: string, enabled: boolean) {
  return useQuery({
    queryKey: GRANTS(surface, agentId),
    queryFn: () => fetchAgentGrants(surface, agentId),
    enabled,
  })
}

export function useReplaceAgentGrants(surface: AgentSurface, agentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      permissions,
      placements,
    }: {
      permissions: string[]
      placements: AgentPlacement[]
    }) => replaceAgentGrants(surface, agentId, permissions, placements),
    onSuccess: (view) => {
      // ⚠️ Seeded rather than invalidated: the answer IS the response, and re-fetching would blank the
      // pane somebody is looking at to arrive at the same thing.
      queryClient.setQueryData(GRANTS(surface, agentId), view)
      void queryClient.invalidateQueries({ queryKey: AGENTS(surface) })
      toast.success("Saved — it applies from the agent's next call")
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "Could not change what this agent holds"))
    },
  })
}

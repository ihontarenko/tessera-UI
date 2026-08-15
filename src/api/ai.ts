import axios from "axios"
import { userManager } from "@/auth/userManager"

/**
 * The machinery behind the assistant and the protocol endpoint, as one screen reads it.
 *
 * ⚠️ **Every route here belongs to `jmouse-ai-management`, not to Tessera** — which is why they answer
 * at `/jmouse-ai` rather than under `/api`. The library's default prefix is kept deliberately: a route
 * that is visibly not this product's is a route a reader will go and look up. Moving them is one
 * `jmouse.ai.management.prefix` line in the backend and the matching Vite proxy entry.
 *
 * ⚠️ **Being outside `/api` is not being outside authorization.** The reads are gated on `ai:read` and
 * the writes on `ai:administer`, at `GLOBAL` — stated in `security/access/AiManagementAccess`, because a
 * library's handler cannot carry the annotation itself, and decided by the same engine as every route
 * Tessera wrote. Reading the trail does not imply spending the money, which is why they are two.
 *
 * ⚠️ **No response here carries a provider key**, and none can be made to: the shapes have no field for
 * one, and the credential is reduced to `keyConfigured` before anything HTTP-shaped sees it.
 */

/**
 * A client of its own, because the base path is.
 *
 * ⚠️ It repeats `httpClient`'s bearer-token interceptor rather than importing it, since that instance is
 * pinned to `/api`. If a third base path ever appears, the interceptor is what to extract — not this.
 */
const managementClient = axios.create({ baseURL: "/jmouse-ai" })

managementClient.interceptors.request.use(async (requestConfiguration) => {
  const user = await userManager.getUser()

  if (user?.access_token) {
    requestConfiguration.headers.set("Authorization", `Bearer ${user.access_token}`)
  }

  return requestConfiguration
})

/** What is actually in force, as the settings source resolved it — not what a row says. */
export interface ActiveProvider {
  providerName: string
  model: string
  apiUrl?: string
  maximumTokens: number
  keyConfigured: boolean
}

export interface AiOverview {
  /** Null when nothing is in force, or when two rows are and the library refuses to choose. */
  activeProvider: ActiveProvider | null
  /** A model **and** a key. The two halves are reported apart so the screen can say which is missing. */
  assistantAvailable: boolean
  /**
   * ⚠️ Whether anything records a per-call trail at all. An installation with no trail and one where
   * nothing has been called produce the same empty list and mean opposite things.
   */
  trailRecorded: boolean
  publishedActions: number
  /** Namespaces, not actions — eight actions may be three tools, so both numbers are reported. */
  publishedTools: number
}

/** One action the catalogue publishes — to a connected client and to the assistant alike. */
export interface PublishedTool {
  publishedName: string
  qualifiedName: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  requiredPermission: string
  readOnly: boolean
  destructive: boolean
  scopeConfined: boolean
  /** `LOCAL`, or `REMOTE` where it is forwarded to a server this installation connected to. */
  origin: string
}

export interface ToolCall {
  operationId: string
  callerId: string
  actingSubject: string
  qualifiedName: string
  scopeId?: string
  scopeLabel?: string
  /** The verdict or the refusal reason — the column worth scanning. */
  outcome: string
  affectedCount: number
  at: string
}

/** Counted by caller, action and outcome, with the outcome kept in the key rather than summed away. */
export interface UsageTotal {
  callerId: string
  qualifiedName: string
  outcome: string
  calls: number
  tokens: number
  lastCalledAt: string
}

export interface ProviderConfiguration {
  id: string
  provider: string
  model: string
  apiUrl?: string
  maximumTokens: number
  active: boolean
  keyConfigured: boolean
  createdAt: string
  updatedAt: string
}

export interface StoredConfigurations {
  supportedProviders: string[]
  configurations: ProviderConfiguration[]
}

/** What somebody typed, on the way in — the library calls it a draft. */
export interface ProviderDraft {
  provider: string
  model: string
  /** ⚠️ Blank on a change means *leave the stored key alone*, never *clear it*. */
  apiKey?: string
  apiUrl?: string
  maximumTokens: number
}

// ── Reading, behind `ai:read` ─────────────────────────────────────────────────

export async function fetchAiOverview(): Promise<AiOverview> {
  const response = await managementClient.get<AiOverview>("/overview")

  return response.data
}

export async function listPublishedTools(): Promise<PublishedTool[]> {
  const response = await managementClient.get<PublishedTool[]>("/tools")

  return response.data
}

export async function listToolCalls(
  parameters: { caller?: string; limit?: number } = {},
): Promise<ToolCall[]> {
  const response = await managementClient.get<ToolCall[]>("/calls", { params: parameters })

  return response.data
}

export async function listUsageTotals(
  parameters: { caller?: string; action?: string } = {},
): Promise<UsageTotal[]> {
  const response = await managementClient.get<UsageTotal[]>("/usage", { params: parameters })

  return response.data
}

// ── Administering, behind `ai:administer` ─────────────────────────────────────

export async function fetchProviderConfigurations(): Promise<StoredConfigurations> {
  const response = await managementClient.get<StoredConfigurations>("/configurations")

  return response.data
}

export async function createProviderConfiguration(
  draft: ProviderDraft,
): Promise<ProviderConfiguration> {
  const response = await managementClient.post<ProviderConfiguration>("/configurations", draft)

  return response.data
}

export async function updateProviderConfiguration(
  id: string,
  draft: ProviderDraft,
): Promise<ProviderConfiguration> {
  const response = await managementClient.put<ProviderConfiguration>(`/configurations/${id}`, draft)

  return response.data
}

/** ⚠️ Putting one in force takes whatever was in force out of it — that is one operation, not two. */
export async function putProviderConfigurationInForce(id: string): Promise<ProviderConfiguration> {
  const response = await managementClient.patch<ProviderConfiguration>(
    `/configurations/${id}/in-force`,
  )

  return response.data
}

export async function takeProviderConfigurationOutOfForce(
  id: string,
): Promise<ProviderConfiguration> {
  const response = await managementClient.delete<ProviderConfiguration>(
    `/configurations/${id}/in-force`,
  )

  return response.data
}

export async function discardProviderConfiguration(id: string): Promise<void> {
  await managementClient.delete(`/configurations/${id}`)
}

// ── Agents ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Whose permissions an agent acts with.
 *
 * `INHERITED` — everything its owner holds, followed live. `RESTRICTED` — its own grants, capped by its
 * owner's. ⚠️ A different question from whether the agent is switched on at all.
 */
export type AgentAuthority = "INHERITED" | "RESTRICTED"

export interface AgentConnection {
  id: string
  agentId: string
  clientName: string
  issuedAt: string
  refreshExpiresAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

/**
 * One agent with the clients connected to it.
 *
 * ⚠️ **`connections` includes revoked ones and `connectionCount` does not.** A screen shows history;
 * "3 clients" must not count endings.
 */
export interface AgentView {
  id: string
  ownerReference: string | null
  name: string
  authority: AgentAuthority
  enabled: boolean
  createdAt: string
  lastActiveAt: string | null
  connectionCount: number
  connections: AgentConnection[]
}

export async function fetchAgents(limit = 100): Promise<AgentView[]> {
  const response = await managementClient.get<AgentView[]>("/agents", { params: { limit } })

  return response.data
}

export async function setAgentEnabled(agentId: string, enabled: boolean): Promise<AgentView> {
  const response = await managementClient.patch<AgentView>(`/agents/${agentId}/enabled`, null, {
    params: { enabled },
  })

  return response.data
}

export async function renameAgent(agentId: string, name: string): Promise<AgentView> {
  const response = await managementClient.patch<AgentView>(`/agents/${agentId}/name`, { name })

  return response.data
}

/** ⚠️ Restricting takes effect on the next call, and an ungranted agent can then do nothing. */
export async function setAgentAuthority(
  agentId: string,
  authority: AgentAuthority,
): Promise<AgentView> {
  const response = await managementClient.patch<AgentView>(`/agents/${agentId}/authority`, {
    authority,
  })

  return response.data
}

export async function revokeAgentConnection(
  agentId: string,
  connectionId: string,
): Promise<AgentView> {
  const response = await managementClient.delete<AgentView>(
    `/agents/${agentId}/connections/${connectionId}`,
  )

  return response.data
}

/** Ends every client of one agent at once, without switching the agent off. */
export async function revokeAllAgentConnections(agentId: string): Promise<AgentView> {
  const response = await managementClient.delete<AgentView>(`/agents/${agentId}/connections`)

  return response.data
}

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
  /** Whether a call could actually be sent — a key is set, OR this provider needs none. */
  usable: boolean
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

/**
 * One provider a configuration may name.
 *
 * ⚠️ `requiresKey: false` is a real answer, not a relaxation — a model on this machine has no
 * credential to give, and demanding one would make the only free option the one nobody can switch on.
 */
export interface SupportedProvider {
  name: string
  defaultApiUrl: string | null
  requiresKey: boolean
  note: string | null
}

export interface StoredConfigurations {
  supportedProviders: string[]
  /** The same list with an address, a note and whether a key is needed, in reading order. */
  providers: SupportedProvider[]
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

// ── Preferences ──────────────────────────────────────────────────────────────────────────────────
//
// One route pair for every setting rather than one per setting: a preference is a declared
// name, some prose and a string, so a second one costs a bean in the backend and nothing here.

/**
 * One stored wording of a setting — a whole prompt, with a name somebody gave it.
 *
 * ⚠️ **Several per setting, one in force**, deliberately the shape a provider configuration already
 * has: keeping the long prompt while trying the short one, and switching back with a press rather than
 * a paste. The assistant reads the one in force and nothing else.
 */
export interface AiPreferenceValue {
  id: string
  label: string
  value: string
  inForce: boolean
  /**
   * Which wording this build ships that this row started as, or null for one somebody wrote here.
   *
   * ⚠️ Provenance only — nothing reads it at runtime. What it buys is *put this back to what the build
   * ships*, which is the difference between experimenting and losing the original.
   */
  shippedKey: string | null
  /** Whether the text still equals what the build ships for that wording. Computed by the server. */
  asShipped: boolean
  createdAt: string
  changedAt: string
}

/**
 * One declared setting with everything stored for it.
 *
 * ⚠️ **Never empty in practice.** A setting with no rows is seeded from what the product ships on the
 * first read, so opening this screen finds the shipped wordings rather than an empty table.
 */
export interface AiPreference {
  name: string
  title: string
  description: string
  /** Whether a screen should offer a text area rather than one line. Presentation only. */
  multiline: boolean
  values: AiPreferenceValue[]
}

/** What somebody typed, on the way in. */
export interface AiPreferenceDraft {
  label: string
  value: string
}

/** ⚠️ Reading seeds: a setting with no rows is filled from what the build ships before this answers. */
export async function fetchAiPreferences(): Promise<AiPreference[]> {
  const response = await managementClient.get<AiPreference[]>("/preferences")

  return response.data
}

/** A new wording, idle — putting it in force is a second request. */
export async function addAiPreferenceValue(
  name: string,
  draft: AiPreferenceDraft,
): Promise<AiPreferenceValue> {
  const response = await managementClient.post<AiPreferenceValue>(`/preferences/${name}`, draft)

  return response.data
}

export async function changeAiPreferenceValue(
  id: string,
  draft: AiPreferenceDraft,
): Promise<AiPreferenceValue> {
  const response = await managementClient.put<AiPreferenceValue>(`/preferences/values/${id}`, draft)

  return response.data
}

/** ⚠️ Takes whatever was in force out of it — one operation, not two. */
export async function putAiPreferenceValueInForce(id: string): Promise<AiPreferenceValue> {
  const response = await managementClient.patch<AiPreferenceValue>(
    `/preferences/values/${id}/in-force`,
  )

  return response.data
}

/** Back to the text this build ships for it. ⚠️ Refuses a wording nobody seeded. */
export async function restoreAiPreferenceValue(id: string): Promise<AiPreferenceValue> {
  const response = await managementClient.post<AiPreferenceValue>(
    `/preferences/values/${id}/shipped`,
  )

  return response.data
}

/** ⚠️ Refuses the one in force, so the assistant is never left with nothing to be told. */
export async function discardAiPreferenceValue(id: string): Promise<void> {
  await managementClient.delete(`/preferences/values/${id}`)
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

/**
 * Which agents a call is about — every one in the installation, or only the caller's own.
 *
 * ⚠️ **Two route families rather than a query parameter, and the difference is authorization.** An
 * administrator's routes take an owner and are gated on one permission; a person's own re-derive the
 * owner from the session and refuse an agent that is not theirs. Everything past that is identical, so
 * one set of functions serves both and one component renders both.
 */
export type AgentSurface = "everyone" | "mine"

function agentsPath(surface: AgentSurface): string {
  return surface === "mine" ? "/my-agents" : "/agents"
}

export async function fetchAgents(
  surface: AgentSurface = "everyone",
  limit = 100,
): Promise<AgentView[]> {
  const response = await managementClient.get<AgentView[]>(agentsPath(surface), {
    // ⚠️ Not sent to the self-scoped route, which is bounded by ownership rather than by a count.
    params: surface === "mine" ? undefined : { limit },
  })

  return response.data
}

export async function setAgentEnabled(
  surface: AgentSurface,
  agentId: string,
  enabled: boolean,
): Promise<AgentView> {
  const response = await managementClient.patch<AgentView>(
    `${agentsPath(surface)}/${agentId}/enabled`,
    null,
    { params: { enabled } },
  )

  return response.data
}

export async function renameAgent(
  surface: AgentSurface,
  agentId: string,
  name: string,
): Promise<AgentView> {
  const response = await managementClient.patch<AgentView>(
    `${agentsPath(surface)}/${agentId}/name`,
    { name },
  )

  return response.data
}

/** ⚠️ Restricting takes effect on the next call, and an ungranted agent can then do nothing. */
export async function setAgentAuthority(
  surface: AgentSurface,
  agentId: string,
  authority: AgentAuthority,
): Promise<AgentView> {
  const response = await managementClient.patch<AgentView>(
    `${agentsPath(surface)}/${agentId}/authority`,
    { authority },
  )

  return response.data
}

export async function revokeAgentConnection(
  surface: AgentSurface,
  agentId: string,
  connectionId: string,
): Promise<AgentView> {
  const response = await managementClient.delete<AgentView>(
    `${agentsPath(surface)}/${agentId}/connections/${connectionId}`,
  )

  return response.data
}

/** Ends every client of one agent at once, without switching the agent off. */
export async function revokeAllAgentConnections(
  surface: AgentSurface,
  agentId: string,
): Promise<AgentView> {
  const response = await managementClient.delete<AgentView>(
    `${agentsPath(surface)}/${agentId}/connections`,
  )

  return response.data
}

/**
 * Throws one of your own away.
 *
 * ⚠️ **Only ever your own — there is no administrator's counterpart, deliberately.** Discarding
 * somebody else's agent from an administration screen is indistinguishable, afterwards, from that
 * person having done it, and the switch beside it stops an agent just as completely while leaving it
 * possible to explain what happened.
 */
export async function discardAgent(agentId: string): Promise<void> {
  await managementClient.delete(`/my-agents/${agentId}`)
}

// ── An agent's own grants ────────────────────────────────────────────────────────────────────────

/** Somewhere an agent can be put to work — a project here, a workspace in the other product. */
export interface AgentPlace {
  id: string
  label: string
}

/** A role it can be given, and whether that role has to be pinned to a place. */
export interface AgentRole {
  name: string
  placeScoped: boolean
}

/** One role held in one place — `placeId` null for an installation-wide role. */
export interface AgentPlacement {
  roleName: string
  placeId: string | null
}

export interface AgentHeld {
  permissions: string[]
  placements: AgentPlacement[]
}

/**
 * What the agent's OWNER could hand down.
 *
 * ⚠️ Not what the installation defines. An agent's set is intersected with its owner's on every
 * request, so offering more would let somebody grant into a void — and the result looks, from outside,
 * exactly like the agent being broken.
 */
export interface AgentOffer {
  permissions: string[]
  places: AgentPlace[]
  roles: AgentRole[]
}

export interface AgentGrantsView {
  held: AgentHeld
  offer: AgentOffer
}

export async function fetchAgentGrants(
  surface: AgentSurface,
  agentId: string,
): Promise<AgentGrantsView> {
  const response = await managementClient.get<AgentGrantsView>(
    `${agentsPath(surface)}/${agentId}/grants`,
  )

  return response.data
}

/** ⚠️ The whole set, never a delta — two people editing with deltas merge into a set neither chose. */
export async function replaceAgentGrants(
  surface: AgentSurface,
  agentId: string,
  permissions: string[],
  placements: AgentPlacement[],
): Promise<AgentGrantsView> {
  const response = await managementClient.put<AgentGrantsView>(
    `${agentsPath(surface)}/${agentId}/grants`,
    { permissions, placements },
  )

  return response.data
}

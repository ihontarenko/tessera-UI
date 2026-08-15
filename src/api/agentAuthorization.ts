import { httpClient } from "@/api/httpClient"

/**
 * What a person does about connections that already exist.
 *
 * ⚠️ **Approving one is not here any more.** The consent screen moved into
 * `jmouse-ai-mcp-authorization` and is served by the backend, so the browser reaches it by redirect and
 * this application never renders it — which is the point: two products used to ask the same question in
 * two design systems, and the parts that mattered were worded differently in each.
 *
 * The client's own half — registering, being redirected, redeeming its code — never touched this module
 * either: it speaks OAuth to the backend directly, without a browser session and without this app.
 */

export interface AgentConnection {
  id: string
  clientName: string
  issuedAt: string
  lastUsedAt: string | null
  revokedAt: string | null
  active: boolean
}

export interface ConnectionInfo {
  /** ⚠️ The server's own answer, not this page's origin — they differ in development. */
  serverUrl: string
}

export function fetchConnectionInfo() {
  return httpClient
    .get<ConnectionInfo>("/agents/authorization/connection-info")
    .then((response) => response.data)
}

export function fetchAgentConnections() {
  return httpClient
    .get<AgentConnection[]>("/agents/authorization/connections")
    .then((response) => response.data)
}

export function revokeAgentConnection(credentialId: string) {
  return httpClient
    .delete<void>(`/agents/authorization/connections/${credentialId}`)
    .then((response) => response.data)
}

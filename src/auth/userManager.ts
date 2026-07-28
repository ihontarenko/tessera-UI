import { UserManager, WebStorageStateStore } from "oidc-client-ts"

/**
 * A public client (no secret) authenticating against Identity via Authorization Code + PKCE — the
 * same pattern Moneta and Central use (see Identity/CLAUDE.md's "Architecture"). Tessera registers
 * its own client (identity.clients.tessera) with audience "tessera"; its access tokens are accepted
 * by Tessera's own backend and, once "tessera" is added to Central's accepted-audiences, by Central
 * for reading shared translations too.
 * Exported as a standalone instance (rather than only living inside <AuthProvider>) so the axios
 * request interceptors in api/httpClient.ts and api/centralClient.ts can read the current access
 * token outside React.
 */
export const userManager = new UserManager({
  authority: import.meta.env.VITE_IDENTITY_ISSUER ?? "http://localhost:9090",
  client_id: import.meta.env.VITE_IDENTITY_CLIENT_ID ?? "tessera-web",
  redirect_uri: `${window.location.origin}/login/oauth2/code/identity`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid profile email",
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
})

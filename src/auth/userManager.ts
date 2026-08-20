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
/**
 * Where Identity is, as seen from THIS browser.
 *
 * ⚠️ **`localhost` cannot be the fallback, because it is not a place — it is whoever is asking.** A
 * phone opening `http://192.168.0.104:5050` would be sent to sign in at its own `localhost:9090`, and
 * the failure reads as Identity being down rather than as an address being wrong. Identity runs beside
 * this interface on the same machine, so the honest default is the host the browser already reached,
 * on Identity's port — which makes localhost and the LAN work from one build with nothing pinned.
 *
 * ⚠️ **The other half of this lives in Identity and is NOT derivable.** OAuth requires an exact match
 * on `redirect_uri`, so every address this interface is opened at must be registered there
 * (`identity.clients.tessera.redirect-uris`). The authority can be inferred; the registration cannot.
 *
 * `VITE_IDENTITY_ISSUER` still wins when set — a deployment where Identity is not a sibling needs it.
 */
const identityAuthority =
  import.meta.env.VITE_IDENTITY_ISSUER ??
  `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_IDENTITY_PORT ?? "9090"}`

export const userManager = new UserManager({
  authority: identityAuthority,
  client_id: import.meta.env.VITE_IDENTITY_CLIENT_ID ?? "tessera-web",
  redirect_uri: `${window.location.origin}/login/oauth2/code/identity`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid profile email",
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
})

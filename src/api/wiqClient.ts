import axios from "axios"
import { userManager } from "@/auth/userManager"

/**
 * Client for **WiQ** — the knowledge product that owns pages (WIQ-10; WIQ-1 §1).
 *
 * <h2>⚠️ Tessera's wiki tab calls WiQ from the browser, and that is the architecture</h2>
 *
 * Separate from {@link httpClient} because it points at a different origin, and shaped after
 * {@link centralClient} because that is the precedent this workspace already set: **the browser calls
 * the other product directly, carrying the user's own Identity token.** There is no backend hop, no
 * token relay and no product-to-product secret anywhere on this path.
 *
 * Which is what makes WiQ's `@CATEGORY` rule true on every screen rather than only on WiQ's own:
 * **WiQ authorises, every time, and Tessera renders what it was given.** A consumer that decided who
 * may read a page would be a second authority, and two authorities cannot guarantee that deny wins.
 *
 * In dev the `/wiq-api` prefix is proxied to WiQ (:8110) by `vite.config.ts`, so the browser sees a
 * same-origin call. In a deployment it is a real cross-origin request and WiQ's own CORS allowlist is
 * what permits it — which is why WiQ is the one backend in this workspace that has one.
 *
 * <h2>⚠️ Being down is a NORMAL state, and this client is where that is enforced</h2>
 *
 * WiQ is a runtime dependency of a screen inside Tessera. So:
 *
 * - **No sign-in redirect on 401.** `centralClient` sets that precedent and states it: a call to
 *   another product must never bounce somebody out of the app they are in. A 401 here means the wiki
 *   tab cannot draw, not that this session is over.
 * - **No retry, and a short timeout.** A product that is down should cost one tab and one honest
 *   sentence, not a screen that hangs.
 * - ⚠️ **And the screen must say "WiQ is down or unreachable" and stop.** Not a spinner that never
 *   ends. Not an empty state reading as *"you have no pages"* — that one is worse than an error,
 *   because it is a plausible lie. Not a 500 that takes the surrounding project screen with it.
 *   {@link isWiqUnreachable} is what tells a screen which of those it is looking at.
 *
 * <h2>⚠️ There is no cache, deliberately</h2>
 *
 * WIQ-1 §12, and the decisive argument is not simplicity: `@CATEGORY` grants are checked on every
 * read, and **a cached page keeps rendering after somebody's access has been taken away.**
 */
export const wiqClient = axios.create({
  baseURL: "/wiq-api",
  timeout: 8000,
})

wiqClient.interceptors.request.use(async (requestConfiguration) => {
  const user = await userManager.getUser()

  if (user?.access_token) {
    requestConfiguration.headers.set("Authorization", `Bearer ${user.access_token}`)
  }

  return requestConfiguration
})

/**
 * Whether this failure means **WiQ could not be reached at all**, as opposed to WiQ answering "no".
 *
 * ⚠️ The distinction is the whole of WIQ-10's second half. *Unreachable* is an infrastructure fact and
 * the screen says so; *403* and *404* are WiQ's own answers about this reader and mean something quite
 * different — usually that they have not been granted the section, which is not a fault at all.
 *
 * A screen that showed one sentence for both would be telling somebody their wiki is broken when it is
 * simply not theirs.
 */
export function isWiqUnreachable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false
  }

  // No response at all: a refused connection, DNS, a timeout, or a CORS preflight WiQ never answered.
  if (!error.response) {
    return true
  }

  // 5xx is WiQ being broken rather than WiQ deciding something.
  return error.response.status >= 500
}

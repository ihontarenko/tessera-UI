import axios from "axios"
import { userManager } from "@/auth/userManager"

/**
 * Client for Innoventa Central — the shared-platform service that owns cross-product concerns like
 * translations. Separate from {@link httpClient} (which targets Tessera's own backend) because it
 * points at a different origin and, deliberately, does NOT signin-redirect on 401: shared copy is a
 * best-effort enhancement, so a failed translations fetch must degrade to the English fallback
 * baked into every `t(key, fallback)` call, never bounce the user out of the app.
 *
 * In dev the `/central-api` prefix is proxied to Central (:9095) by vite.config.ts, so the browser
 * sees a same-origin call and no CORS is involved. Central accepts this app's token once "tessera"
 * is present in its `accepted-audiences` allow-list (see Central/BE's application.yml).
 */
export const centralClient = axios.create({
  baseURL: "/central-api",
})

centralClient.interceptors.request.use(async (requestConfiguration) => {
  const user = await userManager.getUser()

  if (user?.access_token) {
    requestConfiguration.headers.set("Authorization", `Bearer ${user.access_token}`)
  }

  return requestConfiguration
})

import axios, { type AxiosInstance } from "axios"
import { userManager } from "@/auth/userManager"

/**
 * The libraries' own base paths, and the one interceptor they share (`UIK-8`).
 *
 * ⚠️ **A library does not serve under Tessera's `/api`.** That space is this product's, and a library
 * publishing controllers into it collides with whatever the product calls the same thing — which is not
 * hypothetical: `jmouse-storage-management` claimed `/api/files`, exactly where two sibling products
 * served their own, and could not be switched on in either until one side moved.
 *
 * ⚠️ **Tessera never hit that collision** — it has no file routes of its own, so the module worked here
 * from the start. It follows the convention anyway: one address for one library across three products
 * is the point, and a convention that holds everywhere except where somebody got lucky is not one.
 *
 * ⚠️ **Each address is written in THREE files and nothing checks that they agree**: the backend
 * property, the Vite proxy entry, and the constant below. When they drift every call 404s, the screens
 * raise no error of their own, and an issue reads as having no attachments rather than as a routing
 * mistake. Change one, change three.
 *
 * ⚠️ **Outside `/api` is not outside authorization.** These routes are gated by `AttachmentsAccess`,
 * which names a controller class and a method rather than a path — precisely so that moving them cannot
 * un-gate them.
 */

/** `jmouse-storage-management` — attachments. Matches `jmouse.files.management.prefix`. */
export const FILES_MANAGEMENT_BASE = "/jmouse-files/api"

/** A client on one of those base paths, carrying this product's bearer token. */
export function managementClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL })

  client.interceptors.request.use(async (requestConfiguration) => {
    const user = await userManager.getUser()

    if (user?.access_token) {
      requestConfiguration.headers.set("Authorization", `Bearer ${user.access_token}`)
    }

    return requestConfiguration
  })

  return client
}

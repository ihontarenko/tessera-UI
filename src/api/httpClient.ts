import axios, { type AxiosInstance } from "axios"
import { userManager } from "@/auth/userManager"

/**
 * A client on one base path, carrying this product's session.
 *
 * ⚠️ **A factory because there is more than one base path, and only one set of rules.** Tessera's own
 * API answers under `/api`; the jMouse libraries answer under `/jmouse/<namespace>/api`. What must be
 * identical either way is the token on the way out and the sign-in redirect on a 401 — a second client
 * written by hand is how one panel comes to sit on an expired session while every other screen quietly
 * re-authenticates.
 */
export function apiClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL })

  client.interceptors.request.use(async (requestConfiguration) => {
    const user = await userManager.getUser()

    if (user?.access_token) {
      requestConfiguration.headers.set("Authorization", `Bearer ${user.access_token}`)
    }

    return requestConfiguration
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await userManager.signinRedirect({ state: window.location.pathname })
      }

      return Promise.reject(error)
    },
  )

  return client
}

/** Tessera's own API. */
export const httpClient = apiClient("/api")

import axios from "axios"
import { userManager } from "@/auth/userManager"

export const httpClient = axios.create({
  baseURL: "/api",
})

httpClient.interceptors.request.use(async (requestConfiguration) => {
  const user = await userManager.getUser()

  if (user?.access_token) {
    requestConfiguration.headers.set("Authorization", `Bearer ${user.access_token}`)
  }

  return requestConfiguration
})

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await userManager.signinRedirect({ state: window.location.pathname })
    }

    return Promise.reject(error)
  },
)

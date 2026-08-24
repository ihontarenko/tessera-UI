import { transportOver } from "@jmouse/query"
import { httpClient } from "@/api/httpClient"

/**
 * How the shared filter builder reaches Tessera's backend.
 *
 * ## ⚠️ Tessera's OWN client, never a second one
 *
 * `httpClient` carries the bearer token and the interceptors every other screen depends on. A shared
 * package bringing its own client would mean a request that skips all of it — and the failure is a silent
 * 401 on one panel while every other screen is perfectly signed in.
 *
 * ## ⚠️ The prefix is `/query`, because the client's base is already `/api`
 *
 * The library answers on `/api/query` by default (`jmouse.query.builder.prefix`). Moving it on the
 * backend means moving it here — the address lives in exactly two places and there is deliberately no
 * third.
 */
export const queryTransport = transportOver(
  async (method, url, body) => {
    const response = method === "GET" ? await httpClient.get(url) : await httpClient.post(url, body)

    return response.data
  },
  "/query",
)

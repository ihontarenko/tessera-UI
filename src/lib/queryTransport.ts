import { transportOver, type QueryTransport } from "@jmouse/query"
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
const PREFIX = "/query"

const request = async (method: string, url: string, body?: unknown) => {
  const response =
    method === "GET"
      ? await httpClient.get(url)
      : method === "PUT"
        ? await httpClient.put(url, body)
        : method === "DELETE"
          ? await httpClient.delete(url)
          : await httpClient.post(url, body)

  return response.data
}

export const queryTransport: QueryTransport = {
  ...transportOver((method, url, body) => request(method, url, body), PREFIX),

  /**
   * ⚠️ The saved-view half, and naming it here is how this product adopts saved views.
   *
   * The library renders no shelf without it — not an empty one, not a disabled button — because a shelf
   * that can never fill reads as *you have saved nothing* rather than as *this product does not keep
   * these*, and the first is a lie somebody acts on.
   *
   * ⚠️ Which listings actually keep views is still the backend subject's answer
   * (`QuerySubject.holder`), so wiring this does not give every Tessera listing a shelf by accident.
   */
  views: {
    list: (subject) => request("GET", `${PREFIX}/${subject.name}/views`),
    save: (subject, draft) => request("POST", `${PREFIX}/${subject.name}/views`, draft),
    update: (subject, id, draft) => request("PUT", `${PREFIX}/${subject.name}/views/${id}`, draft),
    remove: (subject, id) => request("DELETE", `${PREFIX}/${subject.name}/views/${id}`),
  },
}

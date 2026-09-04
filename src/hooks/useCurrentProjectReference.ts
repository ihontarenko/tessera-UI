import { useEffect, useState } from "react"
import { useMatch } from "react-router-dom"
import { readLastProjectReference, writeLastProjectReference } from "@/lib/lastProject"

/**
 * The project the member is working in, as the URL names it.
 *
 * ⚠️ **A reference, not an identifier.** The route carries a project's **key** now — `/projects/TSSR` —
 * and an identifier only when the link was built before that change. Everything here treats it as an
 * opaque string and compares it with `matchesProject`, which knows both forms; nothing may assume it is
 * one or the other.
 *
 * ⚠️ **Remembered, not current.** Nothing in this application holds a selected project — there is no
 * context and no store. What exists is the route's `:projectId` while somebody is on a project, and
 * `tessera.lastProjectId` in this browser's storage the rest of the time. So the answer is the route's
 * project if there is one, otherwise the last one this browser was in, and `null` before it has ever
 * been in any.
 *
 * ⚠️ **Null is an ordinary answer, not an error.** A first visit, a cleared storage and a browser that
 * refuses `localStorage` outright all land here, so every caller needs somewhere to go when there is no
 * project — see the Issues entry in `navigation.ts`.
 *
 * Being *in* a project is what makes it the last one: the write happens on the route, never on opening
 * a switcher, so a project somebody merely looked at in a menu is not remembered as where they work.
 */
export function useCurrentProjectReference(): string | null {
  const projectRoute = useMatch("/projects/:projectId")
  const routeReference = projectRoute?.params.projectId ?? null

  // Read once, on mount. After that the route is the answer, and re-reading storage every render would
  // be a side effect in a render for a value that cannot have changed under us.
  const [rememberedReference, setRememberedReference] = useState(readLastProjectReference)

  useEffect(() => {
    if (routeReference) {
      writeLastProjectReference(routeReference)
      setRememberedReference(routeReference)
    }
  }, [routeReference])

  return routeReference ?? rememberedReference
}

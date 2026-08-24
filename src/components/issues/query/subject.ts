import type { QuerySubject } from "@jmouse/query"

/**
 * Tessera's filterable listing, as the server names it.
 *
 * ⚠️ This string is the `QuerySubject.name()` of `IssueSubject` in the backend. A name nobody registered
 * is refused by the server naming what is registered — which is the right failure: a builder that quietly
 * drew nothing would read as *this installation has no fields*.
 */
export const ISSUES = "issues"

/**
 * ⚠️ No parameters. Unlike a form-scoped listing, the issue vocabulary is the same everywhere — a
 * project narrows *which issues*, never *what may be asked about them*.
 */
export const issues: QuerySubject = { name: ISSUES }

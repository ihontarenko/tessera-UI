/**
 * How a project is named in a URL.
 *
 * <h2>⚠️ Two forms, and only one of them is written any more</h2>
 *
 * A project's address is its **key** — `/projects/TSSR`. It is readable, quotable, sayable out loud,
 * and it is what the product already prints on every board card. Every link this application builds
 * carries it.
 *
 * The **identifier** form — `/projects/e6e70bea-464e-…` — is what every link built before this change
 * carries, and those are already in chat logs, in wiki pages and in people's history. They keep
 * resolving: the project page accepts either, and heals the address bar towards the key.
 *
 * ⚠️ **A key is configuration and can be re-minted** (`ProjectRekeyService` exists to do exactly that),
 * so an address built on one lives only as long as nobody changes it. That is the trade — an address a
 * person can read against an address that never moves — and it is why the identifier route stays rather
 * than being retired.
 */
const IDENTIFIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Whether this reference is an identifier rather than a key.
 *
 * ⚠️ **Asked this way round on purpose.** A key's shape is the project's own `keyPattern` — an
 * installation decides it, and testing against a guess here would refuse a perfectly good key the day
 * somebody allowed a hyphen. A UUID's shape is fixed by the format, so *that* is the thing worth
 * matching, and everything else is a key by elimination.
 */
export function isProjectIdentifier(reference: string): boolean {
  return IDENTIFIER.test(reference)
}

/**
 * Whether a reference names this project, in either form.
 *
 * ⚠️ **Case-insensitive on the key**, matching the server: a key arrives from a hand-typed URL in
 * whatever case somebody used, and a switcher that failed to tick the row for `/projects/tssr` would
 * be disagreeing with the page it is sitting on.
 */
export function matchesProject(project: { id: string; key: string }, reference: string | null): boolean {
  if (!reference) {
    return false
  }

  return project.id === reference || project.key.toUpperCase() === reference.toUpperCase()
}

/**
 * Where this project lives — the one place a project URL is built.
 *
 * ⚠️ **Takes the key alone, not a whole project.** Several screens hold a narrow projection of a
 * project — a scheme's list of the projects using it, for one — and a signature demanding the full
 * response would send them looking up something they do not need to build a link.
 */
export function projectPath(project: { key: string }, tab?: string): string {
  return tab ? `/projects/${project.key}?tab=${tab}` : `/projects/${project.key}`
}

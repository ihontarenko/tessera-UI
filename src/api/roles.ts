/**
 * The roles a project hands out, mirroring `Roles.PROJECT_ROLES` on the server.
 *
 * ⚠️ **These are the names the engine stores**, not identifiers from a table — `project_roles` is gone
 * (V000014) and with it the `/project-roles` endpoint that used to feed the pickers. A role assignment
 * now carries the same word everywhere: in the policy document, in the access screen, and here.
 *
 * ⚠️ **Which three exist is deliberately not fetched.** They are declared in `policy/tessera.jmp` and
 * cannot be created through any route, so a list here cannot drift from a list a route would return —
 * there is no route. What each role *carries* is another matter entirely, and that is editable: it
 * lives installation-wide behind `access:administer`, which is the whole point of the model.
 */

export const PROJECT_VIEWER = "PROJECT_VIEWER"
export const PROJECT_DEVELOPER = "PROJECT_DEVELOPER"
export const PROJECT_ADMINISTRATOR = "PROJECT_ADMINISTRATOR"

/** Widest last — the order a picker offers them in. */
export const PROJECT_ROLES = [PROJECT_VIEWER, PROJECT_DEVELOPER, PROJECT_ADMINISTRATOR]

const LABELS: Record<string, string> = {
  [PROJECT_VIEWER]: "Viewer",
  [PROJECT_DEVELOPER]: "Developer",
  [PROJECT_ADMINISTRATOR]: "Administrator",
}

/**
 * A role as a person reads it.
 *
 * ⚠️ Anything unrecognised is shown **as the engine spells it** rather than prettified — a role a
 * screen cannot name is a role somebody should see the real name of.
 */
export function roleLabel(roleName: string) {
  return LABELS[roleName] ?? roleName
}

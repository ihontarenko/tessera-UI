/**
 * Every permission the server can be asked about, in one place.
 *
 * ⚠️ **They were spelled out as string literals in fourteen components**, and that is what this module
 * exists to end. A permission is a bare string wherever it is compared, so a literal that has fallen
 * behind the server does not fail — it silently resolves to `false`, and the interface quietly stops
 * offering something the caller is perfectly entitled to do. Nobody reports a button that is missing.
 *
 * ⚠️ **The names changed** when authorization moved to `jmouse-access`: a permission in a policy
 * document must be `namespace:action`, so `BROWSE_PROJECT` became `project:browse`. That rename is
 * exactly the event this module makes survivable — it is one edit here instead of fourteen greps.
 *
 * These are compared against `project.myPermissions`, which the server resolves per project. ⚠️ That
 * answer is never the authority: it exists so the interface stops offering what the server is about to
 * refuse, and every one of them is still checked on the route.
 */

/** See the project and its issues — what every read in a project is gated on. */
export const BROWSE_PROJECT = "project:browse"

export const CREATE_ISSUE = "issue:create"
export const EDIT_ISSUE = "issue:edit"
export const ASSIGN_ISSUE = "issue:assign"
export const TRANSITION_ISSUE = "issue:transition"
export const DELETE_ISSUE = "issue:delete"

/** Comment on issues — and edit or delete your own. */
export const ADD_COMMENT = "comment:write"

export const MANAGE_SPRINT = "sprint:manage"

/** Settings, membership, roles and personal overrides — the project's own administration. */
export const ADMINISTER_PROJECT = "project:administer"

/**
 * Editing the roles every project shares, and reading who holds what.
 *
 * ⚠️ Installation-wide, not a project's: changing what Developer carries changes it everywhere at once.
 */
export const ADMINISTER_ACCESS = "access:administer"

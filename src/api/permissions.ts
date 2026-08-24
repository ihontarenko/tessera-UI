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

/** Settings, and which of the three roles each member holds here — the project's own administration. */
export const ADMINISTER_PROJECT = "project:administer"

/**
 * Editing the roles every project shares, and reading who holds what.
 *
 * ⚠️ Installation-wide, not a project's: changing what Developer carries changes it everywhere at once.
 */
export const ADMINISTER_ACCESS = "access:administer"

/**
 * Editing the catalogs every project runs on — statuses, workflows, issue types, schemes.
 *
 * ⚠️ Installation-wide, and therefore compared against `currentMember.globalPermissions` rather than
 * against a project's `myPermissions`. The configuration is shared by design: adding a transition
 * changes what every project on that workflow may do, which no project's administrator can own.
 */
export const ADMINISTER_CONFIGURATION = "configuration:administer"

/**
 * See what is in force behind the assistant, and what the tools have been asked to do.
 *
 * ⚠️ Installation-wide, and a **disclosure** surface: it reports every caller's activity, not the
 * current member's. Unlike the configuration catalogs — whose reads are deliberately open, because
 * every picker in the product is built from them — these reads are gated, so a member without this one
 * gets a refusal rather than a read-only screen.
 */
export const READ_AI = "ai:read"

/**
 * Choose the model this installation talks to, and hold the key it pays with.
 *
 * ⚠️ Separate from {@link READ_AI} because these are two different powers: reading the trail says what
 * has been spent, this one decides what gets spent. Reading does not imply administering.
 */
export const ADMINISTER_AI = "ai:administer"

/**
 * Administering the installation's people and clients — their names and their faces (TSSR-79).
 *
 * ⚠️ **Its own, because `configuration:administer` says so.** That one is named for the catalogs and
 * its note states that an installation-wide concern which is not the configuration — accounts,
 * licensing, quotas — should have to ask for a grant of its own. This is the first of those.
 *
 * ⚠️ **It does not gate the member directory.** `GET /api/members` stays open to every signed-in
 * caller: it is the picker somebody adds a colleague to a project from.
 */
export const ADMINISTER_MEMBERS = "member:administer"

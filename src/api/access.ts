import { httpClient } from "@/api/httpClient"

/**
 * The installation's access administration — what each role carries, and who holds what where.
 *
 * ⚠️ **Behind `access:administer`, which is installation-wide.** A role is not a project's: changing
 * what `PROJECT_DEVELOPER` carries changes it in every project at once, so this cannot sit under
 * `project:administer`, which somebody may hold in one project and not the next. Per-project membership
 * lives in `projects.ts` and stays where it was.
 *
 * ⚠️ **Saving a bundle changes authorization on the next request.** The engine reads rows; the policy
 * document is only what a fresh installation was born with. The counterpart is `declared`: a role the
 * document declares is rewritten from the file whenever that file changes, so an edit to one is not
 * permanent — which is why the screen says so rather than letting somebody find out after a deploy.
 */

/** A permission, as the policy document describes it. */
export interface PermissionView {
  name: string
  description: string
}

/**
 * One line of a role's bundle.
 *
 * `carriedAt` is a scope **kind**, never an instance: `PROJECT` means "as far as a project", and which
 * project is decided by where the role was assigned.
 */
export interface BundleEntryView {
  permission: string
  carriedAt: string
}

export interface RoleView {
  name: string
  /** The widest scope it may be handed out at. Read-only — it is what stops a project role going global. */
  assignableAt: string
  /** Whether `policy/tessera.jmp` declares it — and therefore whether an edit here survives a re-seed. */
  declared: boolean
  bundle: BundleEntryView[]
}

export interface MemberRef {
  id: string
  displayName: string | null
  email: string | null
}

export interface ProjectRef {
  id: string
  key: string
  name: string
}

export interface RoleHoldingView {
  /** ⚠️ Null where the grant outlived the account: a library table cannot reference this product's rows. */
  member: MemberRef | null
  roleName: string
  scopeType: string
  /** Null for an installation-wide holding. */
  project: ProjectRef | null
  source: string | null
  since: string | null
}

export interface DirectHoldingView {
  member: MemberRef | null
  permission: string
  allowed: boolean
  scopeType: string
  project: ProjectRef | null
  reason: string | null
  since: string | null
}

export interface AccessOverview {
  permissions: PermissionView[]
  roles: RoleView[]
  roleHoldings: RoleHoldingView[]
  directHoldings: DirectHoldingView[]
}

export function getAccessOverview() {
  return httpClient.get<AccessOverview>("/admin/access").then((response) => response.data)
}

/** ⚠️ The whole bundle, never a difference — the last save wins, visibly. */
export function setRoleBundle(roleName: string, bundle: BundleEntryView[]) {
  return httpClient
    .put<RoleView>(`/admin/access/roles/${roleName}/bundle`, { bundle })
    .then((response) => response.data)
}

/**
 * Give somebody a role.
 *
 * ⚠️ `projectId` is null for an installation-wide role and required for a project one — the role's own
 * `assignableAt` decides which, and the server refuses both mistakes rather than correcting them. A
 * project role granted globally would apply to every project there will ever be.
 */
export function assignRole(memberId: string, roleName: string, projectId: string | null) {
  return httpClient.post("/admin/access/assignments", { memberId, roleName, projectId })
}

export function unassignRole(memberId: string, roleName: string, projectId: string | null) {
  return httpClient.delete("/admin/access/assignments", {
    data: { memberId, roleName, projectId },
  })
}

/**
 * Hand one permission to one person, or take one away from them.
 *
 * ⚠️ **A deny beats every role that grants it, from anywhere.** This is how one person loses one power
 * without the role that gives it to everybody else being touched — and it is why `reason` is required
 * rather than optional: a denial nobody can explain outlives whoever made it.
 */
export function grantPermission(
  memberId: string,
  permission: string,
  allowed: boolean,
  projectId: string | null,
  reason: string,
) {
  return httpClient.post("/admin/access/grants", {
    memberId,
    permission,
    allowed,
    projectId,
    reason,
  })
}

/** Take back a personal allow or deny, which restores whatever a role was already saying. */
export function revokePermission(memberId: string, permission: string, projectId: string | null) {
  return httpClient.delete("/admin/access/grants", {
    data: { memberId, permission, projectId },
  })
}

/**
 * The whole authorization, rendered back into the policy language — read-only (TSSR-20).
 *
 * ⚠️ **From the rows, never from `policy/tessera.jmp`.** That file is the seed; the engine reads rows,
 * and the two drift apart the moment somebody edits a bundle on this very screen. A projection of the
 * file would be a prettier copy of exactly the thing that is out of date.
 */
export function getPolicyProjection() {
  return httpClient
    .get<string>("/admin/access/projection", {
      // ⚠️ axios's default transform tries `JSON.parse` on every body and quietly keeps the string when
      // it throws — which is why this works without the option. Said out loud instead: the route serves
      // `text/plain`, so nothing here should be parsing it.
      responseType: "text",
      transformResponse: [(data: string) => data],
    })
    .then((response) => response.data)
}

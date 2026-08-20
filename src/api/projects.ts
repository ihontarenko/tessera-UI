import { httpClient } from "@/api/httpClient"
import type { StatusSummary } from "@/api/issues"
import type { MemberSummary } from "@/api/members"
import type { BoardScopeStrategy } from "@/api/sprints"

export interface SchemeSummary {
  id: string
  name: string
}

export interface ProjectResponse {
  id: string
  key: string
  name: string
  /** One emoji, or null — every screen falls back to the shared folder glyph (TSSR-7). */
  icon: string | null
  /**
   * The only stored answer to "does this project do Scrum?" (ADR-0015). The Backlog view keys off it,
   * and so do the Scrum/Kanban label and default tab — see `lib/projectStyle`. There is no `type`.
   */
  boardScopeStrategy: BoardScopeStrategy
  lead: MemberSummary | null
  issueTypeScheme: SchemeSummary | null
  workflowScheme: SchemeSummary | null
  /** ⚠️ Null means the project does not estimate — the story-points control disappears entirely. */
  estimationScheme: EstimationSchemeSummary | null
  keyStrategy: string
  keyPattern: string | null
  /**
   * Which Kiwi section this project's wiki lives in, or null where nobody has chosen one (KW-1 §3).
   *
   * ⚠️ **An identifier in another service.** Tessera stores it and never validates it — the category
   * lives in Kiwi's database, and asking would make this backend a client of Kiwi, which is the
   * backend-to-backend call KW-1 §1 refuses. A root that stops resolving is a state the wiki tab
   * handles.
   *
   * ⚠️ **Null is ordinary**, and the two empty states it produces are different: *"pick a category"* to
   * an administrator, *"the wiki is not configured"* to everybody else.
   */
  kiwiRootCategoryId: string | null
  myPermissions: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateProjectRequest {
  name: string
  key: string
  /** One emoji, or nothing. ⚠️ Anything that is not a single emoji is refused by the server. */
  icon?: string | null
  /** The "Scrum or Kanban?" answer, sent as the thing it actually sets: the new board's scope. */
  boardScopeStrategy: BoardScopeStrategy
  leadMemberId?: string | null
}

export interface UpdateProjectRequest {
  name: string
  /** ⚠️ Blank clears it — having no icon is a project's ordinary state, not a missing value. */
  icon?: string | null
  leadMemberId: string
  issueTypeSchemeId: string
  workflowSchemeId: string
  /** ⚠️ Null is "does not estimate", not a scale named None. */
  estimationSchemeId?: string | null
  /** One of the shipped formats or CUSTOM — decides the NEXT key, never an existing one. */
  keyStrategy?: string
  /** ⚠️ Read only by CUSTOM, and refused server-side unless it contains a `sequence` placeholder. */
  keyPattern?: string | null
  /** ⚠️ A Kiwi category id, picked from Kiwi's own tree. Blank clears it — "not configured" is a state. */
  kiwiRootCategoryId?: string | null
}

/**
 * A member of one project, and the roles they hold there.
 *
 * ⚠️ **Roles are names now** — `PROJECT_DEVELOPER`, the name the engine stores and the access screen
 * shows — because the table that handed out identifiers is gone. And there is no `overrides` field:
 * a per-person allow or deny was a second answer to what somebody may do, invisible to whoever
 * maintains the roles. Permissions come from roles, edited once, installation-wide.
 */
export interface ProjectMember {
  member: MemberSummary
  roles: string[]
}

/**
 * An estimation scale and its options, in the order the picker offers them.
 *
 * ⚠️ **An item is a (label, weight) pair and the issue stores the weight** (ADR-0019) — `XL` is
 * stored as `8`. Both halves travel because rendering a stored number as the word somebody picked needs
 * the pairs, and `lib/estimation` is the only place that does it.
 */
export interface EstimationSchemeSummary {
  id: string
  name: string
  description: string | null
  items: Array<{ label: string; weight: number }>
}

export interface WorkflowSummary {
  id: string
  name: string
  description: string | null
  transitions: Array<{ id: string; name: string; fromStatusId: string | null; toStatusId: string }>
}

/** ⚠️ `issueTypeIds` is ordered — position **is** the order every picker offers them in. */
export interface IssueTypeSchemeSummary {
  id: string
  name: string
  description: string | null
  defaultIssueTypeId: string | null
  issueTypeIds: string[]
}

/** ⚠️ A type absent from `mappings` runs `defaultWorkflowId` — an empty list is a complete scheme. */
export interface WorkflowSchemeSummary {
  id: string
  name: string
  description: string | null
  defaultWorkflowId: string | null
  mappings: Array<{ issueTypeId: string; workflowId: string }>
}

/**
 * The subset of the global configuration the project screens need.
 *
 * It grew from two scheme lists to this when Settings stopped showing a scheme as a bare name and
 * started showing what selecting one *does* (ticket 06): the issue types a scheme grants, and the
 * statuses and transitions a workflow scheme grants. All of it already came back from
 * `GET /api/configuration` — the client simply used to throw it away.
 */
export interface Configuration {
  issueTypes: Array<{ id: string; name: string; hierarchyLevel: number; iconKey: string | null; description: string | null }>
  // `StatusSummary` rather than a third hand-written copy of the same four fields: every screen that
  // reads this list draws a `StatusPill` from it, and a shape that merely resembles the one the pill
  // takes is a shape that stops matching the day a field is added to it.
  statuses: StatusSummary[]
  workflows: WorkflowSummary[]
  issueTypeSchemes: IssueTypeSchemeSummary[]
  workflowSchemes: WorkflowSchemeSummary[]
  estimationSchemes: EstimationSchemeSummary[]
}

export function listProjects() {
  return httpClient.get<ProjectResponse[]>("/projects").then((response) => response.data)
}

export function getProject(projectId: string) {
  return httpClient.get<ProjectResponse>(`/projects/${projectId}`).then((response) => response.data)
}

export function createProject(request: CreateProjectRequest) {
  return httpClient.post<ProjectResponse>("/projects", request).then((response) => response.data)
}

export function updateProject(projectId: string, request: UpdateProjectRequest) {
  return httpClient.put<ProjectResponse>(`/projects/${projectId}`, request).then((response) => response.data)
}

/**
 * The issue types this project may create, in its scheme's order, plus that scheme's default.
 *
 * Distinct from the global `fetchConfiguration` catalog on purpose: that one lists every type that
 * exists, which is the wrong list to raise an issue from once a project's scheme narrows it.
 */
export interface ProjectIssueTypesResponse {
  issueTypes: Array<{
    id: string
    name: string
    hierarchyLevel: number
    iconKey: string | null
    description: string | null
  }>
  /** Always one of `issueTypes`, or null when the scheme grants none — safe to preselect as-is. */
  defaultIssueTypeId: string | null
}

export function listProjectIssueTypes(projectId: string) {
  return httpClient
    .get<ProjectIssueTypesResponse>(`/projects/${projectId}/issue-types`)
    .then((response) => response.data)
}

export function fetchConfiguration() {
  return httpClient.get<Configuration>("/configuration").then((response) => response.data)
}

export function listProjectMembers(projectId: string) {
  return httpClient.get<ProjectMember[]>(`/projects/${projectId}/members`).then((response) => response.data)
}

export function addProjectMember(projectId: string, memberId: string, roleNames: string[]) {
  return httpClient
    .post<ProjectMember[]>(`/projects/${projectId}/members`, { memberId, roleNames })
    .then((response) => response.data)
}

export function setMemberRoles(projectId: string, memberId: string, roleNames: string[]) {
  return httpClient
    .put<ProjectMember>(`/projects/${projectId}/members/${memberId}/roles`, { roleNames })
    .then((response) => response.data)
}

export function removeProjectMember(projectId: string, memberId: string) {
  return httpClient.delete<void>(`/projects/${projectId}/members/${memberId}`).then((response) => response.data)
}

// Re-exported so the many call sites that already import it from here keep working. The name itself
// lives in `permissions.ts` now, beside the other nine — see that file for why.
export { ADMINISTER_PROJECT } from "./permissions"

/**
 * What the next issue key would look like under a format nobody has saved yet.
 *
 * ⚠️ **Built from the project's real next sequence**, not a made-up example — the question is "what
 * will my keys look like", and a number this project is not on answers a different one.
 */
export interface IssueKeyPreview {
  nextKey: string
  /** A key the project already holds, or null. ⚠️ Existing keys are never regenerated. */
  existingKey: string | null
  formats: Array<{ name: string; example: string | null }>
}

export function fetchIssueKeyPreview(projectId: string, keyStrategy: string, keyPattern: string | null) {
  return httpClient
    .get<IssueKeyPreview>(`/projects/${projectId}/key-preview`, {
      params: keyPattern ? { keyStrategy, keyPattern } : { keyStrategy },
    })
    .then((response) => response.data)
}

/**
 * Changing a project's key, and every issue key under it.
 *
 * ⚠️ **The one project edit that changes an identifier other people are holding.** It is its own
 * endpoint rather than a field on the ordinary save, so that it cannot happen while somebody is saving
 * a name — see `ProjectRekeyService` for what it does and does not rewrite.
 */
export interface RekeyProjectRequest {
  key: string
  /** ⚠️ The project's CURRENT key, typed back. Checked on the server too, not only in the dialog. */
  confirmation: string
}

export interface RekeyProjectResponse {
  project: ProjectResponse
  /** The prefix every stale link out there still carries. */
  previousKey: string
  rewrittenIssues: number
}

export function rekeyProject(projectId: string, request: RekeyProjectRequest) {
  return httpClient
    .post<RekeyProjectResponse>(`/projects/${projectId}/key`, request)
    .then((response) => response.data)
}

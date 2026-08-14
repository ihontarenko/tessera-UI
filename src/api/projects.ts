import { httpClient } from "@/api/httpClient"
import type { StatusCategory } from "@/api/issues"
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
  /**
   * The only stored answer to "does this project do Scrum?" (ADR-0015). The Backlog view keys off it,
   * and so do the Scrum/Kanban label and default tab — see `lib/projectStyle`. There is no `type`.
   */
  boardScopeStrategy: BoardScopeStrategy
  lead: MemberSummary | null
  issueTypeScheme: SchemeSummary | null
  workflowScheme: SchemeSummary | null
  keyStrategy: string
  keyPattern: string | null
  myPermissions: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateProjectRequest {
  name: string
  key: string
  /** The "Scrum or Kanban?" answer, sent as the thing it actually sets: the new board's scope. */
  boardScopeStrategy: BoardScopeStrategy
  leadMemberId?: string | null
}

export interface UpdateProjectRequest {
  name: string
  leadMemberId: string
  issueTypeSchemeId: string
  workflowSchemeId: string
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
 * The subset of the global configuration the project screens need.
 *
 * It grew from two scheme lists to this when Settings stopped showing a scheme as a bare name and
 * started showing what selecting one *does* (ticket 06): the issue types a scheme grants, and the
 * statuses and transitions a workflow scheme grants. All of it already came back from
 * `GET /api/configuration` — the client simply used to throw it away.
 */
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

export interface Configuration {
  issueTypes: Array<{ id: string; name: string; hierarchyLevel: number; iconKey: string | null; description: string | null }>
  statuses: Array<{ id: string; name: string; category: StatusCategory }>
  workflows: WorkflowSummary[]
  issueTypeSchemes: IssueTypeSchemeSummary[]
  workflowSchemes: WorkflowSchemeSummary[]
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

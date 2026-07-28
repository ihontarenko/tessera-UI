import { httpClient } from "@/api/httpClient"
import type { MemberSummary } from "@/api/members"
import type { BoardScopeStrategy } from "@/api/sprints"

export type ProjectType = "SCRUM" | "KANBAN" | "TODO"
export type PermissionEffect = "ALLOW" | "DENY"

export interface SchemeSummary {
  id: string
  name: string
}

export interface ProjectResponse {
  id: string
  key: string
  name: string
  type: ProjectType
  /** Whether this project plans in sprints — the Backlog view keys off this, never off `type` (ADR-0012). */
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
  type: ProjectType
  leadMemberId?: string | null
}

export interface UpdateProjectRequest {
  name: string
  leadMemberId: string
  issueTypeSchemeId: string
  workflowSchemeId: string
}

export interface RoleSummary {
  id: string
  name: string
}

export interface PermissionCatalogEntry {
  id: string
  name: string
  description: string | null
}

export interface OverrideSummary {
  permissionId: string
  permissionName: string
  effect: PermissionEffect
}

export interface ProjectMember {
  member: MemberSummary
  roles: RoleSummary[]
  overrides: OverrideSummary[]
}

// The subset of the global configuration the project screens need (scheme pickers).
export interface Configuration {
  issueTypeSchemes: Array<{ id: string; name: string; description: string | null }>
  workflowSchemes: Array<{ id: string; name: string; description: string | null }>
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

export function fetchConfiguration() {
  return httpClient.get<Configuration>("/configuration").then((response) => response.data)
}

export function fetchProjectRoles() {
  return httpClient.get<RoleSummary[]>("/project-roles").then((response) => response.data)
}

export function fetchPermissions() {
  return httpClient.get<PermissionCatalogEntry[]>("/permissions").then((response) => response.data)
}

export function listProjectMembers(projectId: string) {
  return httpClient.get<ProjectMember[]>(`/projects/${projectId}/members`).then((response) => response.data)
}

export function addProjectMember(projectId: string, memberId: string, roleIds: string[]) {
  return httpClient
    .post<ProjectMember[]>(`/projects/${projectId}/members`, { memberId, roleIds })
    .then((response) => response.data)
}

export function setMemberRoles(projectId: string, memberId: string, roleIds: string[]) {
  return httpClient
    .put<ProjectMember>(`/projects/${projectId}/members/${memberId}/roles`, { roleIds })
    .then((response) => response.data)
}

export function removeProjectMember(projectId: string, memberId: string) {
  return httpClient.delete<void>(`/projects/${projectId}/members/${memberId}`).then((response) => response.data)
}

export function setPermissionOverride(
  projectId: string,
  memberId: string,
  permissionId: string,
  effect: PermissionEffect,
) {
  return httpClient
    .put<ProjectMember>(`/projects/${projectId}/members/${memberId}/overrides`, { permissionId, effect })
    .then((response) => response.data)
}

export function clearPermissionOverride(projectId: string, memberId: string, permissionId: string) {
  return httpClient
    .delete<ProjectMember>(`/projects/${projectId}/members/${memberId}/overrides/${permissionId}`)
    .then((response) => response.data)
}

export const ADMINISTER_PROJECT = "ADMINISTER_PROJECT"

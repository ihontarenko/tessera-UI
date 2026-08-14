import { httpClient } from "@/api/httpClient"
import type { MemberSummary } from "@/api/members"

// ── Shared catalog / summary shapes (mirror the backend dto/issue.* records) ─────────────────────

export type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE"
export type LinkDirection = "OUTWARD" | "INWARD"

export interface IssueTypeSummary {
  id: string
  name: string
  hierarchyLevel: number
  iconKey: string | null
}

export interface PrioritySummary {
  id: string
  name: string
  sequence: number
  color: string | null
}

export interface StatusSummary {
  id: string
  name: string
  category: StatusCategory
}

export interface ResolutionSummary {
  id: string
  name: string
}

export interface IssueRef {
  id: string
  issueKey: string
  summary: string
  type: IssueTypeSummary | null
  status: StatusSummary | null
  open: boolean
}

export interface IssueLinkView {
  id: string
  linkTypeId: string
  linkTypeName: string
  direction: LinkDirection
  label: string
  issue: IssueRef
}

export interface TransitionOption {
  transitionId: string
  name: string
  toStatusId: string
  toStatusName: string
  toCategory: StatusCategory
  requiresResolution: boolean
}

export interface LinkType {
  id: string
  name: string
  outwardLabel: string
  inwardLabel: string
}

// ── Issues ───────────────────────────────────────────────────────────────────────────────────────

export interface IssueRow {
  id: string
  issueKey: string
  sequence: number
  summary: string
  type: IssueTypeSummary | null
  priority: PrioritySummary | null
  status: StatusSummary | null
  resolution: ResolutionSummary | null
  open: boolean
  assignee: MemberSummary | null
  reporter: MemberSummary | null
  storyPoints: number | null
  parentKey: string | null
  rank: string
  updatedAt: string
}

export interface IssueDetail {
  id: string
  projectId: string
  issueKey: string
  sequence: number
  summary: string
  description: string | null
  type: IssueTypeSummary | null
  priority: PrioritySummary | null
  status: StatusSummary | null
  resolution: ResolutionSummary | null
  open: boolean
  reporter: MemberSummary | null
  assignee: MemberSummary | null
  parent: IssueRef | null
  children: IssueRef[]
  storyPoints: number | null
  rank: string
  labels: string[]
  links: IssueLinkView[]
  availableTransitions: TransitionOption[]
  createdAt: string
  updatedAt: string
}

export interface CreateIssueRequest {
  summary: string
  description?: string | null
  issueTypeId: string
  priorityId: string
  assigneeMemberId?: string | null
  parentId?: string | null
  storyPoints?: number | null
}

export interface UpdateIssueRequest {
  summary: string
  description?: string | null
  priorityId: string
  assigneeMemberId?: string | null
  storyPoints?: number | null
}

export interface IssueFilters {
  statusId?: string
  assigneeMemberId?: string
  issueTypeId?: string
  priorityId?: string
}

export function listIssues(projectId: string, filters: IssueFilters = {}) {
  return httpClient
    .get<IssueRow[]>(`/projects/${projectId}/issues`, { params: filters })
    .then((response) => response.data)
}

export function getIssue(issueId: string) {
  return httpClient.get<IssueDetail>(`/issues/${issueId}`).then((response) => response.data)
}

/**
 * The same issue addressed the way people address it to each other. The issue page's URL carries the
 * key, so it is the key the page asks for — resolving one to an id on the client would mean listing
 * issues just to look one up.
 */
export function getIssueByKey(issueKey: string) {
  return httpClient.get<IssueDetail>(`/issues/by-key/${issueKey}`).then((response) => response.data)
}

// ── Cross-project search (ticket 10) ─────────────────────────────────────────────────────────────

export interface IssueSearchItem {
  /** Named per row because a result is only meaningful once you know which project it came from. */
  project: { id: string; key: string; name: string }
  issue: IssueRow
}

export interface IssueSearchPage {
  items: IssueSearchItem[]
  page: number
  size: number
  total: number
}

export interface IssueSearchParameters {
  text?: string
  projectId?: string
  statusId?: string
  assigneeMemberId?: string
  page?: number
  size?: number
}

export function searchIssues(parameters: IssueSearchParameters) {
  return httpClient.get<IssueSearchPage>("/issues/search", { params: parameters }).then((response) => response.data)
}

export function createIssue(projectId: string, request: CreateIssueRequest) {
  return httpClient.post<IssueDetail>(`/projects/${projectId}/issues`, request).then((response) => response.data)
}

export function updateIssue(issueId: string, request: UpdateIssueRequest) {
  return httpClient.put<IssueDetail>(`/issues/${issueId}`, request).then((response) => response.data)
}

export function deleteIssue(issueId: string) {
  return httpClient.delete<void>(`/issues/${issueId}`).then((response) => response.data)
}

export function transitionIssue(issueId: string, toStatusId: string, resolutionId?: string | null) {
  return httpClient
    .post<IssueDetail>(`/issues/${issueId}/transitions`, { toStatusId, resolutionId: resolutionId ?? null })
    .then((response) => response.data)
}

export function setIssueParent(issueId: string, parentId: string | null) {
  return httpClient.put<IssueDetail>(`/issues/${issueId}/parent`, { parentId }).then((response) => response.data)
}

export interface UpdateOrganizationRequest {
  labels: string[]
}

export function updateIssueOrganization(issueId: string, request: UpdateOrganizationRequest) {
  return httpClient.put<IssueDetail>(`/issues/${issueId}/organization`, request).then((response) => response.data)
}

export function addIssueLink(issueId: string, linkTypeId: string, targetIssueId: string) {
  return httpClient
    .post<IssueDetail>(`/issues/${issueId}/links`, { linkTypeId, targetIssueId })
    .then((response) => response.data)
}

export function removeIssueLink(issueId: string, linkId: string) {
  return httpClient.delete<IssueDetail>(`/issues/${issueId}/links/${linkId}`).then((response) => response.data)
}

// ── Comments ─────────────────────────────────────────────────────────────────────────────────────

export interface Comment {
  id: string
  author: MemberSummary | null
  body: string
  editable: boolean
  createdAt: string
  updatedAt: string
}

export function listComments(issueId: string) {
  return httpClient.get<Comment[]>(`/issues/${issueId}/comments`).then((response) => response.data)
}

export function addComment(issueId: string, body: string) {
  return httpClient.post<Comment>(`/issues/${issueId}/comments`, { body }).then((response) => response.data)
}

export function editComment(issueId: string, commentId: string, body: string) {
  return httpClient.put<Comment>(`/issues/${issueId}/comments/${commentId}`, { body }).then((response) => response.data)
}

export function deleteComment(issueId: string, commentId: string) {
  return httpClient.delete<void>(`/issues/${issueId}/comments/${commentId}`).then((response) => response.data)
}

// ── History ──────────────────────────────────────────────────────────────────────────────────────

export interface ActivityLogItem {
  field: string
  oldValue: string | null
  newValue: string | null
}

export interface ActivityLog {
  id: string
  actor: MemberSummary | null
  createdAt: string
  items: ActivityLogItem[]
}

export function listHistory(issueId: string) {
  return httpClient.get<ActivityLog[]>(`/issues/${issueId}/history`).then((response) => response.data)
}

// ── Catalog (global, read-only) ──────────────────────────────────────────────────────────────────

export interface Catalog {
  issueTypes: IssueTypeSummary[]
  priorities: PrioritySummary[]
  statuses: StatusSummary[]
  resolutions: ResolutionSummary[]
}

export function fetchCatalog() {
  return httpClient.get<Catalog>("/configuration").then((response) => ({
    issueTypes: response.data.issueTypes ?? [],
    priorities: response.data.priorities ?? [],
    statuses: response.data.statuses ?? [],
    resolutions: response.data.resolutions ?? [],
  }))
}

export function fetchLinkTypes() {
  return httpClient.get<LinkType[]>("/configuration/link-types").then((response) => response.data)
}

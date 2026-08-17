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
  /** ⚠️ Null means "drawn from the category", never "no colour" — see `StatusPill`. */
  color: string | null
}

export interface ResolutionSummary {
  id: string
  name: string
}

export interface IssueReference {
  /** ⚠️ Null when `readable` is false — a reference nobody may open carries no way to try. */
  id: string | null
  issueKey: string
  /** ⚠️ Null when `readable` is false — somebody else's words, withheld. */
  summary: string | null
  type: IssueTypeSummary | null
  status: StatusSummary | null
  open: boolean
  /**
   * Whether the reader may open this issue.
   *
   * ⚠️ Links cross project boundaries and issues do not, so the far side of one may live in a project
   * the reader is not a member of (TSSR-43). Such a reference is **redacted, never omitted** — a
   * register that silently drops items lies, and "something you cannot see" is information.
   */
  readable: boolean
}

export interface IssueLinkView {
  id: string
  linkTypeId: string
  linkTypeName: string
  direction: LinkDirection
  label: string
  issue: IssueReference
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
  /** When it entered a Done status; null while open (ADR-0011). */
  resolvedAt: string | null
  /** When somebody put it away; null while it is still in view (TSSR-4). */
  archivedAt: string | null
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
  parent: IssueReference | null
  children: IssueReference[]
  storyPoints: number | null
  rank: string
  labels: string[]
  links: IssueLinkView[]
  /**
   * The issue keys holding this one up, or empty.
   *
   * ⚠️ **Keys, never summaries** — a blocker may sit in a project the reader cannot open. And it is
   * *why* `availableTransitions` is short, so the two are read together: a missing button with no
   * explanation is worse than one that was never hidden.
   */
  blockedBy: string[]
  availableTransitions: TransitionOption[]
  createdAt: string
  resolvedAt: string | null
  archivedAt: string | null
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
  /** Open is `resolution IS NULL` — the invariant, not a status name (ADR-0004). */
  openOnly?: boolean
  /**
   * Whether work that has been put away is in the answer (TSSR-4). Search is the one read archived
   * issues stay reachable through — an archive nothing can find again is a delete with extra steps.
   */
  includeArchived?: boolean
  page?: number
  size?: number
}

export function searchIssues(parameters: IssueSearchParameters) {
  return httpClient.get<IssueSearchPage>("/issues/search", { params: parameters }).then((response) => response.data)
}

// ── Registers: who gathers whom (TSSR-45) ────────────────────────────────────────────────────────

/**
 * One gathered issue, as much of it as the reader may see.
 *
 * ⚠️ `projectKey` travels even for an entry that is not `readable` — an issue key already carries its
 * project's key, so hiding the badge beside `INVT-21` would conceal nothing and cost the one column that
 * says where the work sits. The project's *name* does not travel, and is not sent.
 */
export interface IssueRegisterEntry {
  linkId: string
  linkTypeId: string
  linkTypeName: string
  /** The label for this direction — always the outward one here, since a register gathers. */
  label: string
  projectKey: string | null
  issue: IssueReference
}

export interface IssueRegisterItem {
  project: { id: string; key: string; name: string }
  issue: IssueRow
  entries: IssueRegisterEntry[]
  /** How many entries are finished — derived on read from `open`, never stored. */
  done: number
}

export interface IssueRegisterPage {
  items: IssueRegisterItem[]
  page: number
  size: number
  total: number
}

/**
 * The registers — every issue the reader can browse that sits on one end of a link.
 *
 * ⚠️ **`linkTypeId` is optional and is the reader's choice.** The server privileges no type; the Tracked
 * tab merely defaults this to the one named `Tracks` when the installation has such a row. Rename that row
 * and the screen keeps working, which is the whole point (TSSR-40's lesson).
 *
 * ⚠️ **`inward` picks the end, and there is no "both".** `false` lists the issues that gather (`tracks`);
 * `true` lists the ones being gathered (`tracked by`). One link read from both ends is one issue appearing
 * twice for one fact, which is what the mixed list did.
 */
export function fetchIssueRegisters(parameters: {
  linkTypeId?: string
  inward?: boolean
  page?: number
  size?: number
}) {
  return httpClient
    .get<IssueRegisterPage>("/issues/registers", { params: parameters })
    .then((response) => response.data)
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

/**
 * Put finished work away, and take it back out (TSSR-4). Archived is a state on the issue rather than a
 * status, so these are their own pair of routes and not a transition — and both answer with the whole
 * issue, so every cached copy of it can be replaced from one response.
 */
export function archiveIssue(issueId: string) {
  return httpClient.post<IssueDetail>(`/issues/${issueId}/archive`).then((response) => response.data)
}

export function unarchiveIssue(issueId: string) {
  return httpClient.delete<IssueDetail>(`/issues/${issueId}/archive`).then((response) => response.data)
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

/**
 * Retyping a link without unmaking it.
 *
 * ⚠️ **The type only.** A link is `(source, target, type)`; changing an endpoint is a different link and
 * stays delete-and-create. The change is written to the activity log, because retyping is also how
 * somebody lifts a block — `is blocked by` → `relates to` relabels the truth rather than resolving it.
 */
export function changeIssueLinkType(issueId: string, linkId: string, linkTypeId: string) {
  return httpClient
    .put<IssueDetail>(`/issues/${issueId}/links/${linkId}`, { linkTypeId })
    .then((response) => response.data)
}

export function removeIssueLink(issueId: string, linkId: string) {
  return httpClient.delete<IssueDetail>(`/issues/${issueId}/links/${linkId}`).then((response) => response.data)
}

// ── Comments ─────────────────────────────────────────────────────────────────────────────────────

export interface CommentTopicSummary {
  id: string
  name: string
  /** A key the client maps to a drawing — null draws the generic mark. */
  iconKey: string | null
  /** A CSS colour, or null for the muted default. */
  color: string | null
}

export interface Comment {
  id: string
  author: MemberSummary | null
  /** The agent that wrote it, where one did — null where the person typed it themselves. */
  agentName: string | null
  /** What it is about, where somebody said — null for an ordinary remark. */
  topic: CommentTopicSummary | null
  /** ⚠️ The comment this one answers. Replies go **one level deep** — a reply has no replies. */
  parentCommentId: string | null
  body: string
  editable: boolean
  createdAt: string
  updatedAt: string
}

export function listComments(issueId: string) {
  return httpClient.get<Comment[]>(`/issues/${issueId}/comments`).then((response) => response.data)
}

/**
 * ⚠️ **The topic is always sent, including as null.** One request record serves both the create and the
 * edit, so a field left out is a field cleared — an edit that only meant to fix a typo would silently
 * drop the topic off the comment.
 */
export function addComment(
  issueId: string,
  body: string,
  topicId: string | null,
  parentCommentId: string | null = null,
) {
  return httpClient
    .post<Comment>(`/issues/${issueId}/comments`, { body, topicId, parentCommentId })
    .then((response) => response.data)
}

export function editComment(issueId: string, commentId: string, body: string, topicId: string | null) {
  return httpClient
    .put<Comment>(`/issues/${issueId}/comments/${commentId}`, { body, topicId })
    .then((response) => response.data)
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
  /** The agent that made the change, where one did — null where the person did it themselves. */
  agentName: string | null
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

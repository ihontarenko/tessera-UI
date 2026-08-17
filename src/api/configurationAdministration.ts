import { httpClient } from "@/api/httpClient"
import type { StatusCategory } from "@/api/issues"

/**
 * Writing the configuration every project runs on.
 *
 * ⚠️ **Reads here are open; every write is behind `configuration:administer` at `GLOBAL`.** A member
 * without it sees the Administration screens read-only rather than an error, which is why the usage and
 * impact calls are not gated — a screen that is half missing is not "read-only", it is broken.
 *
 * ⚠️ **Editing is in place, and the configuration is shared.** There is no copy-on-write and no draft:
 * renaming a status renames it for every project on every workflow that uses it, on the next request.
 * What replaces safety-by-copying is knowing in advance, which is what every `…Impact` and `usage` call
 * on this module is for. Each is asked *before* the write and rendered inline; the write itself does not
 * ask again, because confirming is the interface's job.
 */

const BASE = "/admin/configuration"

// ── What holds a row ──────────────────────────────────────────────────────────

/** One kind of thing that has a configuration row. `kind` is for branching, `phrase` is for printing. */
export interface UsageHolder {
  kind: string
  count: number
  phrase: string
  names: string[]
}

/**
 * What holds a row, counted and named.
 *
 * ⚠️ The same object comes back on the `409` when a delete is attempted anyway (as the problem's
 * `details`), so the warning and the refusal cannot say different things.
 */
export interface UsageReport {
  holders: UsageHolder[]
}

/**
 * How many issues (or links, or comments) each catalog row holds.
 * ⚠️ A row nothing holds is **absent**, not zero.
 */
export interface ConfigurationCounts {
  issuesByStatus: Record<string, number>
  issuesByIssueType: Record<string, number>
  issuesByPriority: Record<string, number>
  issuesByResolution: Record<string, number>
  linksByLinkType: Record<string, number>
  commentsByTopic: Record<string, number>
}

/** A filter whose expression names a catalog row as a literal, and would quietly stop matching. */
export interface FilterMention {
  source: "builtIn" | "saved"
  id: string
  name: string
  projectId: string | null
  expression: string
}

export function fetchConfigurationCounts() {
  return httpClient.get<ConfigurationCounts>(`${BASE}/counts`).then((response) => response.data)
}

export function fetchRenameImpact(name: string) {
  return httpClient
    .get<FilterMention[]>(`${BASE}/rename-impact`, { params: { name } })
    .then((response) => response.data)
}

export function fetchIssueTypeIcons() {
  return httpClient.get<string[]>(`${BASE}/issue-type-icons`).then((response) => response.data)
}

// ── Priorities ────────────────────────────────────────────────────────────────

export interface PriorityRequest {
  name: string
  color: string | null
}

export interface PriorityResponse {
  id: string
  name: string
  sequence: number
  color: string | null
}

/**
 * ⚠️ Read from the **open** catalog route, not from an administration one.
 *
 * `GET /api/configuration/priorities` is what every picker in the product already reads, so an
 * Administration screen reading a second endpoint would be a second answer to one question — and the
 * one that could quietly fall behind is the one nobody looks at.
 */
export function listPriorities() {
  return httpClient.get<PriorityResponse[]>("/configuration/priorities").then((response) => response.data)
}

export function fetchPriorityUsage(priorityId: string) {
  return httpClient.get<UsageReport>(`${BASE}/priorities/${priorityId}/usage`).then((response) => response.data)
}

export function createPriority(request: PriorityRequest) {
  return httpClient.post<PriorityResponse>(`${BASE}/priorities`, request).then((response) => response.data)
}

export function updatePriority(priorityId: string, request: PriorityRequest) {
  return httpClient
    .put<PriorityResponse>(`${BASE}/priorities/${priorityId}`, request)
    .then((response) => response.data)
}

export function deletePriority(priorityId: string) {
  return httpClient.delete<void>(`${BASE}/priorities/${priorityId}`).then((response) => response.data)
}

/** ⚠️ Every id, in the order they should end up in — see the server's `ReorderRequest` for why. */
export function reorderPriorities(orderedIds: string[]) {
  return httpClient
    .put<PriorityResponse[]>(`${BASE}/priorities/order`, { orderedIds })
    .then((response) => response.data)
}

// ── Resolutions ───────────────────────────────────────────────────────────────

export interface ResolutionRequest {
  name: string
  description: string | null
}

export interface ResolutionResponse {
  id: string
  name: string
  description: string | null
}

/** The same open catalog route the rest of the product reads — see {@link listPriorities}. */
export function listResolutions() {
  return httpClient.get<ResolutionResponse[]>("/configuration/resolutions").then((response) => response.data)
}

export function fetchResolutionUsage(resolutionId: string) {
  return httpClient.get<UsageReport>(`${BASE}/resolutions/${resolutionId}/usage`).then((response) => response.data)
}

export function createResolution(request: ResolutionRequest) {
  return httpClient.post<ResolutionResponse>(`${BASE}/resolutions`, request).then((response) => response.data)
}

export function updateResolution(resolutionId: string, request: ResolutionRequest) {
  return httpClient
    .put<ResolutionResponse>(`${BASE}/resolutions/${resolutionId}`, request)
    .then((response) => response.data)
}

export function deleteResolution(resolutionId: string) {
  return httpClient.delete<void>(`${BASE}/resolutions/${resolutionId}`).then((response) => response.data)
}

// ── Comment topics ────────────────────────────────────────────────────────────

export interface CommentTopicRequest {
  name: string
  description: string | null
  /** A key from `fetchCommentTopicIcons`, or null. ⚠️ Anything else is refused by the server. */
  iconKey: string | null
  /** Any CSS colour, or null for the muted default. */
  color: string | null
}

export interface CommentTopicResponse {
  id: string
  name: string
  description: string | null
  iconKey: string | null
  color: string | null
}

/**
 * The icon keys the client draws for a topic.
 *
 * ⚠️ **A different list from `fetchIssueTypeIcons`.** Those keys name kinds of work, these name kinds of
 * remark — sharing them would offer "Epic" as the drawing for a comment about a root cause.
 */
export function fetchCommentTopicIcons() {
  return httpClient.get<string[]>(`${BASE}/comment-topic-icons`).then((response) => response.data)
}

/** The same open catalog route the rest of the product reads — see {@link listPriorities}. */
export function listCommentTopics() {
  return httpClient.get<CommentTopicResponse[]>("/configuration/comment-topics").then((response) => response.data)
}

export function fetchCommentTopicUsage(commentTopicId: string) {
  return httpClient
    .get<UsageReport>(`${BASE}/comment-topics/${commentTopicId}/usage`)
    .then((response) => response.data)
}

export function createCommentTopic(request: CommentTopicRequest) {
  return httpClient.post<CommentTopicResponse>(`${BASE}/comment-topics`, request).then((response) => response.data)
}

export function updateCommentTopic(commentTopicId: string, request: CommentTopicRequest) {
  return httpClient
    .put<CommentTopicResponse>(`${BASE}/comment-topics/${commentTopicId}`, request)
    .then((response) => response.data)
}

export function deleteCommentTopic(commentTopicId: string) {
  return httpClient.delete<void>(`${BASE}/comment-topics/${commentTopicId}`).then((response) => response.data)
}

// ── Link types ────────────────────────────────────────────────────────────────

/**
 * What a link of a type does, as opposed to what it is called.
 *
 * ⚠️ **Written from the inward side** — the issue reading "is blocked by". The effect is asymmetric, so
 * a boolean could never say which end it applies to.
 */
export type LinkTypeEffect = "NONE" | "WARNS_START" | "BLOCKS_START" | "BLOCKS_DONE"

export interface LinkTypeRequest {
  name: string
  outwardLabel: string
  inwardLabel: string
  effect: LinkTypeEffect
}

export interface LinkTypeResponse {
  id: string
  name: string
  outwardLabel: string
  inwardLabel: string
  effect: LinkTypeEffect
}

/** The same open catalog route the rest of the product reads — see {@link listPriorities}. */
export function listLinkTypes() {
  return httpClient.get<LinkTypeResponse[]>("/configuration/link-types").then((response) => response.data)
}

export function fetchLinkTypeUsage(linkTypeId: string) {
  return httpClient.get<UsageReport>(`${BASE}/link-types/${linkTypeId}/usage`).then((response) => response.data)
}

export function createLinkType(request: LinkTypeRequest) {
  return httpClient.post<LinkTypeResponse>(`${BASE}/link-types`, request).then((response) => response.data)
}

export function updateLinkType(linkTypeId: string, request: LinkTypeRequest) {
  return httpClient
    .put<LinkTypeResponse>(`${BASE}/link-types/${linkTypeId}`, request)
    .then((response) => response.data)
}

export function deleteLinkType(linkTypeId: string) {
  return httpClient.delete<void>(`${BASE}/link-types/${linkTypeId}`).then((response) => response.data)
}

// ── Statuses ──────────────────────────────────────────────────────────────────

export interface StatusRequest {
  name: string
  category: StatusCategory
  /** Any CSS colour. Blank is sent as null and means "drawn from the category". */
  color: string | null
}

export interface StatusResponse {
  id: string
  name: string
  category: StatusCategory
  color: string | null
}

/** One board's share of a category change: the column those cards leave, and the one they arrive in. */
export interface BoardMove {
  projectId: string
  projectKey: string
  projectName: string
  boardId: string
  /** Null means the board maps the status nowhere today, and the backlog is holding it. */
  fromColumnName: string | null
  toColumnName: string | null
  issueCount: number
}

export interface StatusCategoryImpact {
  statusId: string
  statusName: string
  currentCategory: StatusCategory
  proposedCategory: StatusCategory
  issuesHolding: number
  cardsChangingColumn: number
  moves: BoardMove[]
  /** Only non-zero when moving **into** DONE: issues that would be closed-looking but still open. */
  openIssuesEnteringDone: number
}

export function fetchStatusUsage(statusId: string) {
  return httpClient.get<UsageReport>(`${BASE}/statuses/${statusId}/usage`).then((response) => response.data)
}

export function fetchStatusCategoryImpact(statusId: string, category: StatusCategory) {
  return httpClient
    .get<StatusCategoryImpact>(`${BASE}/statuses/${statusId}/category-impact`, { params: { category } })
    .then((response) => response.data)
}

export function createStatus(request: StatusRequest) {
  return httpClient.post<StatusResponse>(`${BASE}/statuses`, request).then((response) => response.data)
}

export function updateStatus(statusId: string, request: StatusRequest) {
  return httpClient.put<StatusResponse>(`${BASE}/statuses/${statusId}`, request).then((response) => response.data)
}

export function deleteStatus(statusId: string) {
  return httpClient.delete<void>(`${BASE}/statuses/${statusId}`).then((response) => response.data)
}

// ── Issue types ───────────────────────────────────────────────────────────────

export interface IssueTypeRequest {
  name: string
  hierarchyLevel: number
  iconKey: string | null
  description: string | null
}

export interface IssueTypeResponse {
  id: string
  name: string
  hierarchyLevel: number
  iconKey: string | null
  description: string | null
}

/** One parent-type / child-type pairing that exists in the data and a level change would invalidate. */
export interface HierarchyPair {
  parentIssueTypeId: string
  parentIssueTypeName: string
  parentLevel: number
  childIssueTypeId: string
  childIssueTypeName: string
  childLevel: number
  count: number
}

export interface IssueTypeLevelImpact {
  issueTypeId: string
  issueTypeName: string
  currentLevel: number
  proposedLevel: number
  violatingPairs: HierarchyPair[]
  /** Only non-zero when the type is leaving level 0 — the level a sprint plans. */
  issuesInSprints: number
}

export function fetchIssueTypeUsage(issueTypeId: string) {
  return httpClient.get<UsageReport>(`${BASE}/issue-types/${issueTypeId}/usage`).then((response) => response.data)
}

export function fetchIssueTypeLevelImpact(issueTypeId: string, hierarchyLevel: number) {
  return httpClient
    .get<IssueTypeLevelImpact>(`${BASE}/issue-types/${issueTypeId}/level-impact`, { params: { hierarchyLevel } })
    .then((response) => response.data)
}

export function createIssueType(request: IssueTypeRequest) {
  return httpClient.post<IssueTypeResponse>(`${BASE}/issue-types`, request).then((response) => response.data)
}

export function updateIssueType(issueTypeId: string, request: IssueTypeRequest) {
  return httpClient
    .put<IssueTypeResponse>(`${BASE}/issue-types/${issueTypeId}`, request)
    .then((response) => response.data)
}

export function deleteIssueType(issueTypeId: string) {
  return httpClient.delete<void>(`${BASE}/issue-types/${issueTypeId}`).then((response) => response.data)
}

// ── Workflows and their transitions ───────────────────────────────────────────

export interface TransitionResponse {
  id: string
  name: string
  /** Null makes it the create transition — the one edge with no source, and there is exactly one. */
  fromStatusId: string | null
  toStatusId: string
}

export interface WorkflowResponse {
  id: string
  name: string
  description: string | null
  transitions: TransitionResponse[]
}

/** One project's board, and the statuses of this workflow it currently shows nowhere. */
export interface UnmappedBoard {
  projectId: string
  projectKey: string
  projectName: string
  boardId: string
  unmappedStatuses: Array<{ id: string; name: string }>
}

export interface WorkflowBoardImpact {
  boards: UnmappedBoard[]
}

/** Every workflow write answers with this: the workflow, and what the change did downstream. */
export interface WorkflowChangeResponse {
  workflow: WorkflowResponse
  boardImpact: WorkflowBoardImpact
}

/** What `WorkflowInvariants` said. A violation refuses; a warning is reported and then obeyed. */
export interface WorkflowVerdict {
  violations: Array<{ rule: string; message: string }>
  warnings: Array<{ rule: string; message: string; count: number }>
}

export interface CreateWorkflowRequest {
  name: string
  description: string | null
  /** Required: a workflow with no create transition makes issue creation fail for every project on it. */
  initialStatusId: string
  createTransitionName: string | null
}

export interface TransitionRequest {
  name: string
  fromStatusId: string | null
  toStatusId: string
}

export function fetchWorkflowUsage(workflowId: string) {
  return httpClient.get<UsageReport>(`${BASE}/workflows/${workflowId}/usage`).then((response) => response.data)
}

export function fetchWorkflowBoardImpact(workflowId: string) {
  return httpClient
    .get<WorkflowBoardImpact>(`${BASE}/workflows/${workflowId}/board-impact`)
    .then((response) => response.data)
}

export function fetchTransitionRemovalImpact(workflowId: string, transitionId: string) {
  return httpClient
    .get<WorkflowVerdict>(`${BASE}/workflows/${workflowId}/transitions/${transitionId}/removal-impact`)
    .then((response) => response.data)
}

export function createWorkflow(request: CreateWorkflowRequest) {
  return httpClient.post<WorkflowChangeResponse>(`${BASE}/workflows`, request).then((response) => response.data)
}

export function updateWorkflow(workflowId: string, request: { name: string; description: string | null }) {
  return httpClient
    .put<WorkflowChangeResponse>(`${BASE}/workflows/${workflowId}`, request)
    .then((response) => response.data)
}

export function deleteWorkflow(workflowId: string) {
  return httpClient.delete<void>(`${BASE}/workflows/${workflowId}`).then((response) => response.data)
}

export function addTransition(workflowId: string, request: TransitionRequest) {
  return httpClient
    .post<WorkflowChangeResponse>(`${BASE}/workflows/${workflowId}/transitions`, request)
    .then((response) => response.data)
}

export function renameTransition(workflowId: string, transitionId: string, name: string) {
  return httpClient
    .put<WorkflowChangeResponse>(`${BASE}/workflows/${workflowId}/transitions/${transitionId}`, { name })
    .then((response) => response.data)
}

export function removeTransition(workflowId: string, transitionId: string) {
  return httpClient
    .delete<WorkflowChangeResponse>(`${BASE}/workflows/${workflowId}/transitions/${transitionId}`)
    .then((response) => response.data)
}

// ── Schemes ───────────────────────────────────────────────────────────────────

/** A project as the scheme screens name it — enough to print, enough to link to. */
export interface ProjectReference {
  id: string
  key: string
  name: string
}

/**
 * Which projects are on which scheme, both kinds at once, plus the two a new project starts on.
 *
 * ⚠️ **The blast radius is on the screen permanently, not behind a confirmation.** Editing a scheme is
 * editing every project on it, and a dialog that says so once Delete is pressed says it after the
 * decision was made.
 *
 * ⚠️ A scheme nothing uses is **absent** from the maps, not an empty array — readers default.
 */
export interface SchemeUsageReport {
  byIssueTypeScheme: Record<string, ProjectReference[]>
  byWorkflowScheme: Record<string, ProjectReference[]>
  defaultIssueTypeSchemeId: string
  defaultWorkflowSchemeId: string
}

export interface IssueTypeSchemeRequest {
  name: string
  description: string | null
  defaultIssueTypeId: string
  /** ⚠️ Position **is** the order the pickers offer them in — there is no separate sequence. */
  issueTypeIds: string[]
}

export interface WorkflowSchemeRequest {
  name: string
  description: string | null
  defaultWorkflowId: string
  /** A type with no entry runs the default; an empty list is an ordinary scheme, not a broken one. */
  mappings: { issueTypeId: string; workflowId: string }[]
}

/**
 * What removing a type from a scheme would mean.
 *
 * ⚠️ Reported, never a refusal: those issues keep their type and stay readable — what stops is raising
 * new ones on this scheme.
 */
export interface SchemeMemberImpact {
  issueTypeId: string
  issueTypeName: string
  issues: number
  projects: number
}

/** What a new project starts on. ⚠️ Changing it touches the **next** project and no existing one. */
export interface InstanceDefaults {
  defaultIssueTypeSchemeId: string
  defaultIssueTypeSchemeName: string | null
  defaultWorkflowSchemeId: string
  defaultWorkflowSchemeName: string | null
  /** ⚠️ Null where new projects do not estimate — an answer, not an absence to be filled in. */
  defaultEstimationSchemeId: string | null
  defaultEstimationSchemeName: string | null
}

export function fetchSchemeUsage() {
  return httpClient.get<SchemeUsageReport>(`${BASE}/scheme-usage`).then((response) => response.data)
}

export function fetchIssueTypeSchemeUsage(schemeId: string) {
  return httpClient
    .get<UsageReport>(`${BASE}/issue-type-schemes/${schemeId}/usage`)
    .then((response) => response.data)
}

export function fetchSchemeRemovalImpact(schemeId: string, issueTypeId: string) {
  return httpClient
    .get<SchemeMemberImpact>(`${BASE}/issue-type-schemes/${schemeId}/removal-impact`, {
      params: { issueTypeId },
    })
    .then((response) => response.data)
}

export function createIssueTypeScheme(request: IssueTypeSchemeRequest) {
  return httpClient.post<void>(`${BASE}/issue-type-schemes`, request).then((response) => response.data)
}

export function updateIssueTypeScheme(schemeId: string, request: IssueTypeSchemeRequest) {
  return httpClient
    .put<void>(`${BASE}/issue-type-schemes/${schemeId}`, request)
    .then((response) => response.data)
}

export function deleteIssueTypeScheme(schemeId: string) {
  return httpClient.delete<void>(`${BASE}/issue-type-schemes/${schemeId}`).then((response) => response.data)
}

export function fetchWorkflowSchemeUsage(schemeId: string) {
  return httpClient
    .get<UsageReport>(`${BASE}/workflow-schemes/${schemeId}/usage`)
    .then((response) => response.data)
}

export function createWorkflowScheme(request: WorkflowSchemeRequest) {
  return httpClient.post<void>(`${BASE}/workflow-schemes`, request).then((response) => response.data)
}

export function updateWorkflowScheme(schemeId: string, request: WorkflowSchemeRequest) {
  return httpClient
    .put<void>(`${BASE}/workflow-schemes/${schemeId}`, request)
    .then((response) => response.data)
}

export function deleteWorkflowScheme(schemeId: string) {
  return httpClient.delete<void>(`${BASE}/workflow-schemes/${schemeId}`).then((response) => response.data)
}

export function fetchInstanceDefaults() {
  return httpClient.get<InstanceDefaults>(`${BASE}/defaults`).then((response) => response.data)
}

export function setInstanceDefaults(request: {
  defaultIssueTypeSchemeId: string
  defaultWorkflowSchemeId: string
  defaultEstimationSchemeId: string | null
}) {
  return httpClient.put<InstanceDefaults>(`${BASE}/defaults`, request).then((response) => response.data)
}

// ── Estimation scales ─────────────────────────────────────────────────────────

/**
 * A scale and its options.
 *
 * ⚠️ **An item is a `(label, weight)` pair and the issue stores the weight** (ADR-0019) — `XL` lives in
 * `story_points` as `8`, which is why burndown, velocity and every filter were untouched by this.
 */
export interface EstimationSchemeRequest {
  name: string
  description: string | null
  /** ⚠️ Position **is** the order the picker offers them in. Labels are unique; weights need not be. */
  items: { label: string; weight: number }[]
}

export function fetchEstimationSchemeUsage(schemeId: string) {
  return httpClient
    .get<UsageReport>(`${BASE}/estimation-schemes/${schemeId}/usage`)
    .then((response) => response.data)
}

export function createEstimationScheme(request: EstimationSchemeRequest) {
  return httpClient.post<void>(`${BASE}/estimation-schemes`, request).then((response) => response.data)
}

export function updateEstimationScheme(schemeId: string, request: EstimationSchemeRequest) {
  return httpClient
    .put<void>(`${BASE}/estimation-schemes/${schemeId}`, request)
    .then((response) => response.data)
}

export function deleteEstimationScheme(schemeId: string) {
  return httpClient.delete<void>(`${BASE}/estimation-schemes/${schemeId}`).then((response) => response.data)
}

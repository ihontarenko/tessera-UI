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

/**
 * How pressing an issue is **today**, derived by the server from its three dates and stored nowhere.
 *
 * ⚠️ **Ordered by severity, and the server decides which one wins.** A commitment outranks a plan: an
 * issue queued for next week whose deadline was yesterday is `OVERDUE`, never `SCHEDULED`. Nothing in
 * this interface re-derives that — a card painted amber beside a filter calling the same issue overdue
 * is exactly the drift one source of truth exists to prevent.
 */
export type ScheduleState = "NONE" | "SCHEDULED" | "QUEUED" | "RED_LINE" | "DUE_TODAY" | "OVERDUE"

/**
 * When an issue is meant to happen.
 *
 * ⚠️ **Never null on an issue** — an unscheduled one carries `state: "NONE"` with three null dates, so
 * a reader never has to tell "nothing scheduled" apart from "the field was not sent".
 */
export interface IssueSchedule {
  /** The day somebody means to pick it up — a plan, freely moved, cleared when the issue is resolved. */
  queuedFor: string | null
  /** The day it stops being comfortable — a warning set ahead of the commitment. Kept after completion. */
  redLine: string | null
  /** The day it is due — a commitment to somebody else. Kept after completion. */
  deadline: string | null
  state: ScheduleState
  /**
   * Whole days from today to the deadline; negative once past, null with no deadline.
   *
   * ⚠️ Computed on the server rather than here, because it is also what a board filter compares against
   * — and two subtractions either side of a timezone give two different numbers for one issue.
   */
  daysUntilDeadline: number | null
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
  /**
   * The permanent identifier — see `IssueDetail.hash`.
   *
   * ⚠️ On a **row** because a row is where somebody decides to quote something: the link dialog's issue
   * picker reads it, and a second request per row to fetch six characters would turn a list into a
   * waterfall.
   */
  hash: string
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
  /** When it is meant to happen, and how pressing that is today. Never null. */
  schedule: IssueSchedule
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
  /**
   * The permanent identifier — six characters, drawn once, changed by nothing.
   *
   * ⚠️ **What a reference stored outside this tracker resolves through.** A key is formatted by the
   * project's key strategy and can be re-minted; anything written into a page or another product's
   * description carries this instead, and `CopyReferenceAction` is what hands it out.
   */
  hash: string
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
  /** When it is meant to happen, and how pressing that is today. Never null. */
  schedule: IssueSchedule
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

/**
 * The hierarchy level at which a parent may hold work in another project (TSSR-56).
 *
 * ⚠️ **A second copy of `IssueHierarchyService.PROJECT_SPANNING_LEVEL`, and there is no way around it.**
 * The server owns the rule and refuses on it; this exists so a picker does not offer what is about to be
 * refused. It is stated here rather than derived so the two are compared by somebody reading them, and
 * a client that got it wrong offers a bad candidate — it never lets one through.
 */
export const PROJECT_SPANNING_LEVEL = 2

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
  /**
   * A jMQ expression over the issue vocabulary — the same words the board filter uses.
   *
   * ⚠️ It does not replace the controls above; where both arrive the **expression wins** and they are
   * ignored, because two narrowings silently intersecting is a result nobody can explain. The `jmq:`
   * prefix keeps an expression sort and a plain column sort from ever being confused.
   */
  "jmq:filter"?: string
  "jmq:order"?: string
  /**
   * What to order by, from `IssueSortOrder`'s closed list on the server — the same vocabulary
   * `issueSorting.ts` holds.
   *
   * ⚠️ **Ignored when `jmq:order` is present**, because an expression carries its own ordering. The
   * screen stops sending it rather than relying on that, so a control is never on screen claiming to do
   * something the server is dropping.
   */
  sort?: string
  direction?: "asc" | "desc"
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
  /**
   * How the relationship reads **from the heading issue** — the outward label when it gathers, the inward one
   * when it is gathered. ⚠️ Not always outward: the screen asks for one side at a time, and a list of
   * "tracked by" rows labelled "tracks" states the relationship backwards.
   */
  label: string
  projectKey: string | null
  issue: IssueReference
}

export interface IssueRegisterItem {
  /** ⚠️ Null where the project row has gone missing under the issue — the server sends null rather than lying. */
  project: { id: string; key: string; name: string } | null
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

/**
 * When the issue is meant to happen — all three dates, replaced together.
 *
 * ⚠️ **A full replacement, so a missing date clears it.** JSON gives an absent field and an explicit
 * `null` the same value on the way in, so "leave this one alone" is not something the request could
 * express — and a shape that could not express "clear the deadline" would be a schedule nobody could
 * cancel. Anything changing one date therefore sends the other two back unchanged, which is what
 * `useIssueEditing.schedule` does.
 */
export function updateIssueSchedule(
  issueId: string,
  schedule: { queuedFor: string | null; redLine: string | null; deadline: string | null },
) {
  return httpClient.put<IssueDetail>(`/issues/${issueId}/schedule`, schedule).then((response) => response.data)
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
  // ⚠️ `agentName` was here and is gone (TSSR-34). `author` IS the agent where one wrote it, and
  // `author.kind` says so — one reference instead of a chip plus a string beside it.
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
  // ⚠️ `agentName` was here and is gone (TSSR-34) — `actor.kind` says whether a client did it.
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

// ── The other search: relevance, not a filtered table (TSSR-156) ─────────────────────────────────

/**
 * One issue a relevance search found, and **why**.
 *
 * ⚠️ **Not an `IssueSearchPage` item, and the difference is the whole feature.** That one is a row of a
 * filtered table: the reader chose a project, a status and a sort column, so what they need is the
 * issue's fields. This is a row of a *search*: the reader chose nothing, and their two questions are
 * *where is this* and *why is it in front of me*.
 *
 * - `snippets` — the passages that matched, out of the description **or the comments**. Without them a
 *   result cannot be judged without opening it.
 * - `why` — the reckoning in one line, e.g. `"key EXACT ×8.0 = 8.00, summary ALL_TERMS ×4.0 = 2.08"`.
 *   From the library's structured relevance; a ranking nobody can question is one nobody can fix.
 *
 * ⚠️ The snippets carry **no** highlight markup — the same strings are read by a person, a screen and a
 * model, and only one of those wants markup. Marking the terms is this client's two lines.
 */
export interface IssueMatch {
  project: { id: string; key: string; name: string }
  issue: IssueRow
  snippets: string[]
  /** On the library's shared weight scale. Means nothing on its own — never render it as a percentage. */
  score: number
  why: string
}

/**
 * Issues answering these words, best first, across every project the caller may browse.
 *
 * ⚠️ **Words, not a phrase, and it reads the comments.** `/issues/search` matches the whole query
 * against the summary and the key only — so a two-word query fails, and a decision recorded in a thread
 * is invisible. This is the route for *where did we write that down*; that one stays the Issues table.
 *
 * @param project narrow to one project. ⚠️ Narrowing only — a project the caller cannot browse answers
 *                empty rather than reaching into it.
 */
export function findIssues(query: string, project?: string | null, limit?: number) {
  return httpClient
    .get<IssueMatch[]>("/issues/find", { params: { query, project: project ?? undefined, limit } })
    .then((response) => response.data)
}

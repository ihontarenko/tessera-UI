import type { IssueRow } from "@/api/issues"

/**
 * What a list of issues may be ordered by — one vocabulary, two lists, and one place it is written down.
 *
 * <h2>⚠️ Two lists that sort in genuinely different places</h2>
 *
 * A project's list arrives whole and is filtered in the browser, so it sorts there too: a click reorders
 * what is already on screen, with no request. The cross-project search is paged **in the database**, so it
 * cannot — sorting twenty-five rows of two hundred would reorder the page rather than the list, which is
 * the kind of wrong that looks right. It therefore sends `sort` and `direction` to the server, where
 * `IssueSortOrder` holds the same vocabulary this file does.
 *
 * ⚠️ **So the vocabulary is the intersection, deliberately.** A field one list offers and the other does
 * not is the same control behaving differently on two screens. The single exception is stated as one:
 * {@link RANK} is project-only, because a LexoRank orders a *board* and a board belongs to one project —
 * ordering six projects' issues by it interleaves six independent sequences into one meaningless list.
 *
 * ⚠️ **Nothing here is a column name reaching a database.** `wireName` is a token the server matches
 * against its own closed list, and a name it does not know falls back to its default rather than failing.
 */

export type SortDirection = "asc" | "desc"

export interface IssueSortOption {
  /** What travels to the server, and what a URL would carry. Matches `IssueSortOrder.wireName()`. */
  id: string
  /** Translation key and English fallback — the products translate, this file does not. */
  labelKey: string
  label: string
  /**
   * Which way round is useful the first time it is chosen.
   *
   * ⚠️ Per field rather than a global default, because "descending" is right for a date and absurd for a
   * summary. Somebody who picks *Updated* wants the newest and somebody who picks *Summary* wants A first.
   */
  defaultDirection: SortDirection
  /**
   * Ascending comparison, for the list that sorts in the browser. Undefined where the field is only
   * meaningful server-side.
   *
   * ⚠️ It returns the ASCENDING answer always; the direction is applied once, by {@link sortIssues}.
   * A comparator that knew about direction would be eight comparators each able to get it wrong.
   */
  compare?: (left: IssueRow, right: IssueRow) => number
  /** False where the cross-project list cannot offer it — see {@link RANK}. */
  global?: boolean
}

/** Where the board put it. ⚠️ Project-only — see the note above. */
const RANK: IssueSortOption = {
  id: "rank",
  labelKey: "issues.sort.rank",
  label: "Board order",
  defaultDirection: "asc",
  compare: (left, right) => left.rank.localeCompare(right.rank),
  global: false,
}

/**
 * ⚠️ By `sequence`, not by the key as text. Within one project the number *is* the key, and it is also
 * the order the issues were created in — whereas `TSSR-9` sorts after `TSSR-10` as text unless every key
 * happens to be padded to the same width.
 */
const KEY: IssueSortOption = {
  id: "key",
  labelKey: "issues.sort.key",
  label: "Key",
  defaultDirection: "asc",
  compare: (left, right) => left.sequence - right.sequence,
}

const SUMMARY: IssueSortOption = {
  id: "summary",
  labelKey: "issues.sort.summary",
  label: "Summary",
  defaultDirection: "asc",
  compare: (left, right) => (left.summary ?? "").localeCompare(right.summary ?? ""),
}

/**
 * By hierarchy level, so an epic and the stories under it land at opposite ends rather than interleaved
 * alphabetically. Descending by default: the broadest thing first is how somebody reads a project.
 */
const TYPE: IssueSortOption = {
  id: "type",
  labelKey: "issues.sort.type",
  label: "Type",
  defaultDirection: "desc",
  compare: (left, right) => (left.type?.hierarchyLevel ?? 0) - (right.type?.hierarchyLevel ?? 0),
}

/**
 * ⚠️ By NAME, not by category. The category is `TO_DO | IN_PROGRESS | DONE` and would sort `DONE` first
 * as text — alphabetical order dressed up as workflow order, which is worse than plainly alphabetical.
 * What this sort is actually used for is grouping the same status together, and a name does that.
 */
const STATUS: IssueSortOption = {
  id: "status",
  labelKey: "issues.sort.status",
  label: "Status",
  defaultDirection: "asc",
  compare: (left, right) => (left.status?.name ?? "").localeCompare(right.status?.name ?? ""),
}

/** By the catalogue's own `sequence` — severity, which is the only thing "sort by priority" can mean. */
const PRIORITY: IssueSortOption = {
  id: "priority",
  labelKey: "issues.sort.priority",
  label: "Priority",
  defaultDirection: "asc",
  compare: (left, right) => (left.priority?.sequence ?? 0) - (right.priority?.sequence ?? 0),
}

/**
 * ⚠️ Unestimated last whichever way round it is sorted, and that is not an inconsistency. A null here
 * means *nobody has estimated this*, which is not a small number and not a large one — putting it at
 * whichever end the direction implies would claim an estimate that was never made.
 */
const POINTS: IssueSortOption = {
  id: "points",
  labelKey: "issues.sort.points",
  label: "Story points",
  defaultDirection: "desc",
  compare: (left, right) => (left.storyPoints ?? 0) - (right.storyPoints ?? 0),
}

const UPDATED: IssueSortOption = {
  id: "updated",
  labelKey: "issues.sort.updated",
  label: "Updated",
  defaultDirection: "desc",
  compare: (left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt),
}

/**
 * Soonest first — "what is up next" is the question this column exists to answer, so ascending is the
 * useful direction and it opens that way.
 *
 * ⚠️ **An unset date sorts last whichever way round it is**, like {@link POINTS} and for the same
 * reason: null here means *nobody has said when*, which is neither an early day nor a late one. Putting
 * it at whichever end the direction implies would claim a plan that was never made — and anybody sorting
 * by a schedule is looking for the rows that have one.
 */
function byDate(pick: (issue: IssueRow) => string | null | undefined) {
  return (left: IssueRow, right: IssueRow) => {
    const leftDate = pick(left)
    const rightDate = pick(right)

    if (!leftDate && !rightDate) {
      return 0
    }
    if (!leftDate) {
      return 1
    }
    if (!rightDate) {
      return -1
    }

    return leftDate.localeCompare(rightDate)
  }
}

const QUEUED_FOR: IssueSortOption = {
  id: "queuedFor",
  labelKey: "issues.sort.queuedFor",
  label: "Queued for",
  defaultDirection: "asc",
  compare: byDate((issue) => issue.schedule.queuedFor),
}

const RED_LINE: IssueSortOption = {
  id: "redLine",
  labelKey: "issues.sort.redLine",
  label: "Red line",
  defaultDirection: "asc",
  compare: byDate((issue) => issue.schedule.redLine),
}

const DEADLINE: IssueSortOption = {
  id: "deadline",
  labelKey: "issues.sort.deadline",
  label: "Deadline",
  defaultDirection: "asc",
  compare: byDate((issue) => issue.schedule.deadline),
}

export const ISSUE_SORTS: IssueSortOption[] = [
  RANK,
  KEY,
  SUMMARY,
  TYPE,
  STATUS,
  PRIORITY,
  POINTS,
  QUEUED_FOR,
  RED_LINE,
  DEADLINE,
  UPDATED,
]

/** What a project's list offers. */
export const PROJECT_SORTS = ISSUE_SORTS

/** What the cross-project list offers — everything the database can order by. */
export const GLOBAL_SORTS = ISSUE_SORTS.filter((option) => option.global !== false)

/**
 * Both lists open on what moved last, newest first.
 *
 * ⚠️ **The project list opened on `rank` and no longer does.** Board order is the right answer on a
 * board, where somebody dragged the cards into it deliberately; on a flat list of a few hundred issues
 * it is an order nobody chose — a LexoRank that mostly reflects the sequence things were created in, so
 * the screen opened on the oldest work in the project and everything raised this week was pages down.
 * The sort control still offers board order for anybody who wants it.
 */
export const PROJECT_DEFAULT_SORT = UPDATED.id
export const GLOBAL_DEFAULT_SORT = UPDATED.id

export function findSort(id: string, within: IssueSortOption[] = ISSUE_SORTS): IssueSortOption {
  return within.find((option) => option.id === id) ?? within[0]
}

/**
 * The rows, ordered.
 *
 * ⚠️ **A copy, never in place.** The array handed in is react-query's cached data; sorting it where it
 * lies mutates the cache, so every other reader of that query silently gets this screen's ordering — and
 * the mutation happens during a render, which React is entitled to run twice.
 *
 * ⚠️ **Nulls last, always, whichever direction.** An issue with no story points and one with no assignee
 * are not *low* values, they are absent ones; sending them to whichever end the direction implies would
 * be the list asserting something nobody entered.
 */
export function sortIssues(
  rows: IssueRow[],
  sortId: string,
  direction: SortDirection,
  within: IssueSortOption[] = ISSUE_SORTS,
): IssueRow[] {
  const option = findSort(sortId, within)

  if (option.compare === undefined) {
    return rows
  }

  const compare = option.compare
  const sign = direction === "desc" ? -1 : 1

  return [...rows].sort((left, right) => {
    const leftMissing = isMissing(left, option)
    const rightMissing = isMissing(right, option)

    if (leftMissing !== rightMissing) {
      return leftMissing ? 1 : -1
    }

    const ordered = compare(left, right) * sign

    // ⚠️ Ties broken by key, so the list does not reshuffle between two renders of the same data — six
    // issues at the same priority in a different order each time reads as a screen that cannot sit still.
    return ordered !== 0 ? ordered : left.sequence - right.sequence
  })
}

/** Whether the value this sort reads is absent rather than small. */
function isMissing(row: IssueRow, option: IssueSortOption): boolean {
  switch (option.id) {
    case "points":
      return row.storyPoints === null || row.storyPoints === undefined
    case "priority":
      return row.priority === null
    case "type":
      return row.type === null
    case "status":
      return row.status === null
    default:
      return false
  }
}

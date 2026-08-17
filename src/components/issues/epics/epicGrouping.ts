import type { IssueRow } from "@/api/issues"

/** An epic and everything beneath it — or, with a null epic, the work that belongs to none. */
export interface EpicGroup {
  epic: IssueRow | null
  issues: IssueRow[]
  done: number
}

/** ⚠️ An issue type's level, where `1` and above is an epic. A missing type cannot head a group. */
const EPIC_LEVEL = 1

/**
 * Depth cap for the walk up the parent chain.
 *
 * ⚠️ **A guard against data, not against the model.** Hierarchy is three levels deep by design
 * (epic → story → sub-task), so anything past a handful means a cycle — which the server refuses to create
 * but a hand-written `UPDATE` would not. An infinite loop here freezes the tab rather than showing bad data,
 * so it is worth the constant.
 */
const MAXIMUM_DEPTH = 10

/**
 * The project's issues, gathered under the epic each one belongs to.
 *
 * ⚠️ **By ancestor, not by direct parent.** A sub-task's parent is a story, so grouping on `parentKey` alone
 * would file it under nothing and the tab would quietly hold fewer issues than the project has. The walk is
 * the same reading `EpicResolver` uses for the board's Epic swimlanes — one definition of "which epic is this
 * in", not two that disagree on sub-tasks.
 *
 * ⚠️ **Flattened, not nested.** Everything beneath an epic is one list. A tree would draw two levels of
 * indent to say what the key already says, on a screen whose question is *how much of this epic is done*.
 *
 * ⚠️ **Epics with nothing under them are kept, and so is the "no epic" group.** Both are the answer to a
 * real question — an epic nobody has broken down yet, and work nobody has filed. Dropping either makes the
 * screen hold fewer issues than the project has, with nothing saying so.
 */
export function groupByEpic(issues: IssueRow[]): EpicGroup[] {
  const issuesByKey = new Map(issues.map((issue) => [issue.issueKey, issue]))
  const epics = issues.filter(isEpic)

  const membersByEpicKey = new Map<string, IssueRow[]>(epics.map((epic) => [epic.issueKey, []]))
  const orphans: IssueRow[] = []

  for (const issue of issues) {
    if (isEpic(issue)) {
      continue
    }

    const epicKey = epicKeyOf(issue, issuesByKey)
    const members = epicKey === null ? undefined : membersByEpicKey.get(epicKey)

    if (members) {
      members.push(issue)
    } else {
      orphans.push(issue)
    }
  }

  const groups: EpicGroup[] = epics.map((epic) => toGroup(epic, membersByEpicKey.get(epic.issueKey) ?? []))

  if (orphans.length > 0) {
    groups.push(toGroup(null, orphans))
  }

  return groups
}

function toGroup(epic: IssueRow | null, issues: IssueRow[]): EpicGroup {
  // Finished is `resolution IS NULL` inverted (ADR-0004) — `open` already carries it.
  return { epic, issues, done: issues.filter((issue) => !issue.open).length }
}

function isEpic(issue: IssueRow): boolean {
  return (issue.type?.hierarchyLevel ?? 0) >= EPIC_LEVEL
}

/** The key of this issue's epic ancestor, or null when it has none. */
function epicKeyOf(issue: IssueRow, issuesByKey: Map<string, IssueRow>): string | null {
  let current = issue

  for (let depth = 0; depth < MAXIMUM_DEPTH; depth += 1) {
    const parentKey = current.parentKey

    if (parentKey === null) {
      return null
    }

    const parent = issuesByKey.get(parentKey)

    // ⚠️ A parent outside the list is not an error: the list can be filtered, and an ancestor that was
    // filtered out is simply not reachable from here. Its child lands in "no epic" rather than nowhere.
    if (!parent) {
      return null
    }

    if (isEpic(parent)) {
      return parent.issueKey
    }

    current = parent
  }

  return null
}

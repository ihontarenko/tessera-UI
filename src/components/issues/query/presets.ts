import type { QueryPreset } from "@jmouse/query"

/**
 * The questions people ask of a tracker before they think of writing one.
 *
 * ## ⚠️ Written in the board filter's own words
 *
 * `issue.assignee == currentMember` is what the jME board filter already says, and these say it too. Two
 * filter surfaces on one product is tolerable; two *vocabularies* for the same fields is not, because
 * then knowing one screen actively misleads you about the other.
 *
 * ## ⚠️ Offered only where the schema can answer them
 *
 * Each declares what it needs and is filtered against the vocabulary the server sent. That matters less
 * here than in a product with per-form fields — the issue schema is fixed — but it is the mechanism that
 * keeps a preset from outliving the attribute it names.
 */
export const ISSUE_PRESETS: readonly QueryPreset[] = [
  {
    label: "Mine, open",
    explains: "Assigned to you and not resolved",
    needs: ["issue.assignee", "issue.resolution"],
    filter: "issue.assignee == currentMember and issue.resolution is null",
    sort: { by: "issue.updatedAt", descending: true },
  },
  {
    label: "Reported by me",
    explains: "Everything you raised, resolved or not",
    needs: ["issue.reporter"],
    filter: "issue.reporter == currentMember",
    sort: { by: "issue.createdAt", descending: true },
  },
  {
    label: "Unassigned",
    explains: "Open work nobody has picked up",
    needs: ["issue.assignee", "issue.resolution"],
    filter: "issue.assignee is null and issue.resolution is null",
  },
  {
    label: "In progress",
    explains: "Everything on the middle of a board somewhere",
    needs: ["issue.status.category"],
    filter: "issue.status.category == 'IN_PROGRESS'",
    sort: { by: "issue.updatedAt", descending: true },
  },
  {
    label: "Stale",
    explains: "Unfinished and untouched for two weeks",
    needs: ["issue.status.category", "issue.updatedAt"],
    filter: "issue.status.category != 'DONE' and issue.updatedAt < now() - days(14)",
    sort: { by: "issue.updatedAt" },
  },
  {
    label: "Unestimated",
    explains: "Open work carrying no story points",
    needs: ["issue.points", "issue.resolution"],
    filter: "issue.points is null and issue.resolution is null",
  },
]

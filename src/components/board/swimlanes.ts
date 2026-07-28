import type { BoardCard, SwimlaneStrategy } from "@/api/boards"

/**
 * Swimlane grouping (Phase-2 ticket 04) — computed entirely on the client from keys the board payload
 * already carries (`assigneeId`, `epicKey`, `priorityId`); the server returns a flat slice and never
 * groups (ADR-0009).
 *
 * The seam is {@link SwimlaneGrouping}: a new grouping kind is one entry in {@link GROUPINGS} plus one
 * enum value, never a change to the grouping algorithm itself.
 */

/** The single lane a `NONE` board renders into — a titleless lane holding every card. */
export const FLAT_LANE_ID = "__flat__"

/** The catch-all lane for cards the active grouping has no key for ("No epic", "Unassigned", …). */
export const UNGROUPED_LANE_ID = "__ungrouped__"

export interface Swimlane {
  id: string
  /** `null` renders no lane header — the flat, ungrouped board. */
  title: string | null
  cards: BoardCard[]
}

/** How one grouping kind reads a card. Adding a kind means adding one of these — nothing else. */
interface SwimlaneGrouping {
  /** Stable lane key, or `null` when the card has no value for this grouping. */
  keyOf: (card: BoardCard) => string | null
  /** Lane title, derived from any card in the lane (they all share the key). */
  titleOf: (card: BoardCard) => string
  /** Title of the catch-all lane collecting the cards `keyOf` returned `null` for. */
  ungroupedTitle: string
}

const GROUPINGS: Record<Exclude<SwimlaneStrategy, "NONE">, SwimlaneGrouping> = {
  ASSIGNEE: {
    keyOf: (card) => card.assigneeId,
    titleOf: (card) => card.assignee?.displayName ?? card.assignee?.email ?? "Unknown member",
    ungroupedTitle: "Unassigned",
  },
  EPIC: {
    keyOf: (card) => card.epicKey,
    titleOf: (card) => card.epicKey ?? "",
    ungroupedTitle: "No epic",
  },
  PRIORITY: {
    keyOf: (card) => card.priorityId,
    titleOf: (card) => card.priority?.name ?? "Unknown priority",
    ungroupedTitle: "No priority",
  },
}

export const SWIMLANE_LABEL: Record<SwimlaneStrategy, string> = {
  NONE: "No swimlanes",
  ASSIGNEE: "By assignee",
  EPIC: "By epic",
  PRIORITY: "By priority",
}

/**
 * Group `cards` into lanes under `strategy`. Lanes follow first appearance in the (rank-ordered) card
 * list, so lane order is stable and matches the board's own ordering; the catch-all lane always sorts
 * last so nothing disappears but nothing outranks a real lane either.
 *
 * Always returns at least one lane — an empty board still needs its columns to be drop targets.
 */
export function groupIntoSwimlanes(cards: BoardCard[], strategy: SwimlaneStrategy): Swimlane[] {
  if (strategy === "NONE") {
    return [{ id: FLAT_LANE_ID, title: null, cards }]
  }

  const grouping = GROUPINGS[strategy]
  const lanes = new Map<string, Swimlane>()
  const ungrouped: BoardCard[] = []

  for (const card of cards) {
    const key = grouping.keyOf(card)
    if (key === null) {
      ungrouped.push(card)
      continue
    }

    const lane = lanes.get(key)
    if (lane) {
      lane.cards.push(card)
    } else {
      lanes.set(key, { id: key, title: grouping.titleOf(card), cards: [card] })
    }
  }

  if (ungrouped.length > 0) {
    lanes.set(UNGROUPED_LANE_ID, { id: UNGROUPED_LANE_ID, title: grouping.ungroupedTitle, cards: ungrouped })
  }

  if (lanes.size === 0) {
    return [{ id: FLAT_LANE_ID, title: null, cards: [] }]
  }

  return [...lanes.values()]
}

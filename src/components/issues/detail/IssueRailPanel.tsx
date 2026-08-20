import type { ReactNode } from "react"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { Button } from "@jmouse/ui"
import { useStoredPreference } from "@/hooks/useStoredPreference"

/** Tailwind's `lg` — below it the rail is under the content rather than beside it. */
const RAIL_SITS_BESIDE_CONTENT_FROM = 1024

const RAIL_PREFERENCE_KEY = "tessera.issue.rail"

/**
 * Whether the issue rail is showing — remembered, because it is taste rather than navigation.
 *
 * ⚠️ **The first answer depends on the window and every answer after it does not.** On a narrow screen
 * the rail is 290px the description does not have to spare, so it starts folded away; once somebody has
 * said which they want, that is the answer on every issue they open. A preference that kept
 * second-guessing the window would undo the choice each time the browser was resized.
 */
export function useIssueRailVisibility() {
  const [preference, remember] = useStoredPreference<"open" | "closed">(
    RAIL_PREFERENCE_KEY,
    window.innerWidth < RAIL_SITS_BESIDE_CONTENT_FROM ? "closed" : "open",
  )

  const open = preference === "open"

  return { open, toggle: () => remember(open ? "closed" : "open") }
}

/**
 * The rail as a column of the issue screen: the properties when it is open, a strip against the edge
 * when it is not.
 *
 * <h2>⚠️ Folded away is a 36px strip, not nothing</h2>
 *
 * <p>A panel that vanishes entirely takes its own way back with it, and a rail is where somebody looks
 * for the rail. The strip costs the description almost none of its width and keeps it in place.
 *
 * <p>⚠️ **Below `lg` the strip becomes a plain button instead.** There the rail stacks *under* the
 * description rather than beside it, so an edge strip would be a full-width bar reading sideways across
 * the middle of the screen — and that width is where hiding the rail matters most, so it cannot simply
 * be left with no way back.
 *
 * <p>⚠️ **The control lives on the rail rather than in the screen's header**, because this component is
 * mounted by both the issue page and the quick view and only one of them has a header. A switch that
 * existed on one screen and not the other is how two surfaces stop being the same issue.
 */
export function IssueRailAside({
  open,
  onToggle,
  children,
}: {
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  if (!open) {
    return (
      <>
        <div className="hidden lg:flex lg:w-9 lg:flex-none lg:justify-center lg:border-l lg:pt-1">
          <button
            type="button"
            title="Show the properties"
            aria-expanded={false}
            className="flex flex-col items-center gap-2 rounded-md px-1.5 py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={onToggle}
          >
            <PanelRightOpen className="size-4" />
            <span className="text-[10px] font-medium tracking-wider uppercase [writing-mode:vertical-rl]">
              Details
            </span>
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={false}
          className="w-full lg:hidden"
          onClick={onToggle}
        >
          <PanelRightOpen className="mr-1 size-3.5" />
          Show the details
        </Button>
      </>
    )
  }

  return (
    <aside className="w-full min-w-0 lg:w-[290px] lg:flex-none">
      <div className="mb-1 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded
          title="Hide the details"
          className="h-6 px-1.5 text-muted-foreground"
          onClick={onToggle}
        >
          <PanelRightClose className="size-3.5" />
        </Button>
      </div>
      {children}
    </aside>
  )
}

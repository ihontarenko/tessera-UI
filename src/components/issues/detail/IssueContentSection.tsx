import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/helpers"

/**
 * One of the blocks that run down an issue's content column under the description — Attachments,
 * Relations, Activity.
 *
 * <h2>⚠️ It exists because the three of them disagreed, in four ways at once</h2>
 *
 * <p>Each was built where it was needed and none looked at the others, so a reader scrolling one column
 * met: two heading typefaces (`text-[10px]` muted for two of them, `font-display text-sm` for Activity);
 * two left edges (a label pushed 18px in by its own chevron, sitting above a body that was not); two
 * placements for the header's action (Attach crowded against its heading, Link thrown to the far right);
 * and two ideas of what the number beside a heading counts. None of it was a decision — it was three
 * files.
 *
 * <h2>The alignment rule, which is the whole point of the component</h2>
 *
 * <p>⚠️ **The chevron lives in a gutter of its own, and everything else in the section — the title, the
 * meta, the body — shares one left edge to the right of it.** A heading indented past its own rows is
 * what made the column read as ragged. The gutter is {@link GUTTER} wide and is drawn even for a section
 * that does not fold, so a foldable and a fixed section still line up with each other.
 *
 * <p>It is not hung into the page's own padding instead, which would let the title sit flush with the
 * description above: there are 16px there, the chevron needs 18, and on a narrow viewport the arrow
 * would be clipped against the sidebar.
 *
 * <h2>⚠️ A plain button, not Radix's `Collapsible`</h2>
 *
 * <p>Its trigger toggles the root it sits inside, and the body here is a sibling of the header rather
 * than a child of it — the header carries the section's action too, which must not fold away with the
 * rows. A `Collapsible` wrapping only its own trigger toggles nothing, which is exactly what it did.
 * Everything that component would have contributed is the three attributes below.
 */

/**
 * The chevron's column: `size-3.5` plus the `gap-1` after it. Every left edge in a section derives from
 * it — and it is exported because {@link IssueActivityStream} is the one block that cannot use this
 * component (it never folds, and it drops its heading entirely in the quick view) while still having to
 * land on the same edge as the blocks above it.
 */
export const ISSUE_SECTION_GUTTER = "pl-[1.125rem]"

const GUTTER = ISSUE_SECTION_GUTTER

export function IssueContentSection({
  id,
  title,
  meta,
  action,
  open,
  onToggle,
  children,
}: {
  /** Ties the body to the trigger's `aria-controls`. Omitted for a section that does not fold. */
  id?: string
  title: string
  /** The count, or whatever else the heading is worth saying in a few characters. */
  meta?: ReactNode
  /** The header's own control — Attach, Link, a filter. Always at the far right, in every section. */
  action?: ReactNode
  /**
   * Whether the body is shown. ⚠️ A section **folds only when it is given an `onToggle`** — the quick
   * view renders these same blocks inside a dialog, where the pane the reader opened is already them
   * asking for it, and a control that cannot do anything is worse than no control.
   */
  open?: boolean
  onToggle?: () => void
  children: ReactNode
}) {
  const foldable = onToggle !== undefined
  const shown = !foldable || open === true

  const heading = (
    <span className="flex items-baseline gap-2">
      <span className="font-display text-sm font-semibold uppercase tracking-wide">{title}</span>
      {meta !== undefined && meta !== null && (
        <span className="text-[11px] font-normal tabular-nums normal-case">{meta}</span>
      )}
    </span>
  )

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {foldable ? (
          <button
            type="button"
            aria-expanded={shown}
            aria-controls={id}
            className="flex items-center gap-1 rounded text-muted-foreground transition-colors hover:text-foreground"
            onClick={onToggle}
          >
            <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", shown && "rotate-90")} />
            {heading}
          </button>
        ) : (
          // The same gutter, empty — a fixed section's title has to land on the foldable ones' title.
          <h2 className={cn("flex items-center text-muted-foreground", GUTTER)}>{heading}</h2>
        )}

        {action}
      </div>

      <div id={id} className={GUTTER}>
        {shown && children}
      </div>
    </section>
  )
}

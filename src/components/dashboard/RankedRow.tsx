import type { ReactNode } from "react"
import { Link } from "react-router-dom"

/**
 * One ranked item: what it is, how big, and a bar saying so.
 *
 * ⚠️ **A bar list, and that is a considered form rather than a fallback.** The question both users of
 * this ask — what is stuck, what is blocked — is about *identity* first: the answer somebody acts on is
 * a list of issues, not a distribution. A scatter would show the spread better and be unreadable at the
 * height a dashboard card gives it; a bar chart with issue keys on the axis is this, with the summary
 * thrown away. So the row keeps the summary, carries its magnitude as a bar, and is a link — which is
 * the one thing no chart mark can be.
 *
 * ⚠️ **The bar is scaled against the largest row, not against a fixed maximum.** These are ranked
 * lists; the shape worth seeing is how far the top item is ahead of the rest, and a fixed scale would
 * flatten every row to a stub on a quiet week.
 *
 * ⚠️ **The number is written out beside the bar.** Colour here carries the status category, several
 * rows can share one, and a length is hard to read to a value — so the magnitude is text and the bar is
 * the thing that makes the ranking visible at a glance.
 */
export function RankedRow({
  to,
  title,
  subtitle,
  value,
  unit,
  share,
  color,
}: {
  to: string
  title: string
  subtitle: ReactNode
  value: number
  unit: string
  /** 0..1 — this row's magnitude against the largest in the list. */
  share: number
  color: string
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex flex-col gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/40"
      >
        <span className="flex items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{title}</span>
          <span className="min-w-0 flex-1 truncate text-sm">{subtitle}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {value} {unit}
          </span>
        </span>

        <span className="flex h-1 w-full overflow-hidden rounded-full bg-muted">
          <span
            className="h-full rounded-full"
            style={{ width: `${Math.max(share, 0.02) * 100}%`, backgroundColor: color }}
          />
        </span>
      </Link>
    </li>
  )
}

/** How many rows a dashboard card holds before it stops being a glance and starts being a report. */
export const RANKED_ROWS = 6

/**
 * The line under a capped list, or nothing when there is no tail.
 *
 * ⚠️ **A truncated list that does not say so reads as the whole picture.** These two cards show the
 * worst few of something somebody is meant to act on, and "the six oldest" and "the six we have" are
 * very different sentences.
 */
export function RankedTail({ shown, total, label }: { shown: number; total: number; label: string }) {
  if (total <= shown) {
    return null
  }

  return <p className="px-2 pt-1 text-[11px] text-muted-foreground">{label}</p>
}

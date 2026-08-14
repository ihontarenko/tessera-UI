import { cn } from "@/lib/helpers"

export interface Segment<Value extends string> {
  value: Value
  label: string
}

/**
 * A small group of mutually exclusive choices — pick one, the others turn off.
 *
 * Written once because two screens had grown the same markup with slightly different corners, and it
 * shows: the radii come from the theme's `--radius` the way every button does, so the control sits in
 * the same family as the board's filter toggles rather than reading as a sharp-cornered stranger. The
 * track is `rounded-lg`, the thumb `rounded-md`, which is the nesting the rest of the interface uses.
 *
 * Not a Radix component and not a Tabs: there is no panel relationship to model. It is a value and a
 * setter, which is why it takes exactly those.
 */
export function SegmentedControl<Value extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
  fill = false,
  className,
}: {
  segments: Segment<Value>[]
  value: Value
  onChange: (value: Value) => void
  ariaLabel: string
  /** Stretch to the container. Off by default — a control sized to its own words reads as a filter. */
  fill?: boolean
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex gap-0.5 rounded-lg border bg-muted/40 p-0.5", fill && "flex w-full", className)}
    >
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          onClick={() => onChange(segment.value)}
          aria-pressed={value === segment.value}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            fill && "flex-1",
            value === segment.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {segment.label}
        </button>
      ))}
    </div>
  )
}

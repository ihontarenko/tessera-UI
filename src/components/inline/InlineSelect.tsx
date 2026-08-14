import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/helpers"

export interface InlineSelectOption {
  value: string
  label: string
}

/**
 * A field you pick from, drawn as plain text until hovered — and backed by a native `<select>`.
 *
 * Native, deliberately. Text size is applied as `body.style.zoom` (see `ThemeContext`), and inside a
 * zoomed subtree Radix's popper positions its panel from a `getBoundingClientRect()` that no longer
 * describes where the trigger really is: at the larger scales the list opens outside the viewport and
 * the control reads as broken — click it, nothing happens. A native select's list is drawn by the
 * browser outside the document entirely, so there is no coordinate to get wrong, and it stays keyboard
 * and screen-reader correct for free.
 *
 * The trade is that the option list takes the platform's styling rather than the theme's. For a rail of
 * short, frequently-changed fields that is a good trade; the styled `Select` stays everywhere the list
 * itself carries design (the board's filters, the settings screens).
 */
export function InlineSelect({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: {
  value: string
  options: InlineSelectOption[]
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full appearance-none rounded-md border border-transparent bg-transparent py-1 pr-6 pl-2 text-sm",
          "hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

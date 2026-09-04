import type { ReactNode } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jmouse/ui"
import { cn } from "@/lib/helpers"

export interface InlineSelectOption {
  value: string
  label: string
  /**
   * What the row and the trigger draw instead of the bare label — an avatar beside a name, a coloured
   * dot, whatever the value actually looks like elsewhere on the screen.
   *
   * ⚠️ **`label` stays required even when this is given**, because it is still the value's text: the
   * panel's type-ahead reads it, and a caller comparing options works with strings. This is the picture,
   * not the name.
   */
  content?: ReactNode
}

/**
 * A field you pick from, drawn as plain text until hovered.
 *
 * ⚠️ **It used to be a native `<select>`, and the option list was the reason it stopped being one.** A
 * native list is drawn by the operating system, which knows nothing about this application's theme: on a
 * dark theme the list opened white, with grey-on-white options that were barely readable. That is not a
 * styling preference — a control whose menu is illegible is broken, and it was broken on exactly the
 * screens where the rail is used most.
 *
 * The reasons it was native are both spent. It was native originally because the positioning library
 * opened its panel outside the viewport under the font-scale `zoom`; that is fixed for everything now
 * (`components/ui/anchored.tsx`). It stayed native for the platform list's speed and its free keyboard
 * and screen-reader behaviour — but this application's own `Select` is not Radix either: it is a plain
 * anchored panel with roving focus, type-ahead, `role="listbox"` and `aria-selected` already in it.
 *
 * What is kept is the *look*, which is what "inline" meant here: no border until hovered, no background,
 * the height of a line of text. A rail of these still reads as a column of values rather than a stack of
 * form controls.
 *
 * ⚠️ **Disabled is also how a value that nobody edits is drawn**, not only how a value this reader may
 * not edit is. A rail whose editable fields sit inside a control and whose fixed ones sit beside it has
 * two left edges and two heights; putting the fixed one in the same shell is what lines the column up.
 * So a disabled one keeps full opacity and grows no border on hover — it is a *reading*, and fading it
 * would say "you are not allowed", which is not what it means.
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
  /** Omitted where the control is disabled: a value nobody edits has nothing to hand back. */
  onChange?: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <SelectField
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel={ariaLabel}
        disabled={disabled}
      />
    </div>
  )
}

/**
 * The control itself, separated from the wrapper so the wrapper's `className` keeps meaning what it did:
 * call sites pass a border there to make a picker look like a field rather than like text.
 */
function SelectField({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: string
  options: InlineSelectOption[]
  onChange?: (value: string) => void
  ariaLabel: string
  disabled: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          // Overriding the trigger's field styling back to plain text — the whole point of an inline
          // control. Everything else about it (the anchored panel, the keyboard handling) is unchanged.
          "h-auto w-full border-transparent bg-transparent px-2 py-1 text-sm shadow-none",
          "data-[size=default]:h-auto hover:border-input dark:bg-transparent dark:hover:bg-transparent",
          // A disabled one is a value being read, not a control being refused: full opacity, an ordinary
          // cursor, and no border promised on hover.
          "disabled:cursor-default disabled:opacity-100 disabled:hover:border-transparent",
        )}
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.content ?? option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

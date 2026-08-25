import { ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jmouse/ui"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/helpers"
import { findSort, type IssueSortOption, type SortDirection } from "@/components/issues/sorting/issueSorting"

/**
 * How a list of issues is ordered: the field, and which way round.
 *
 * <h2>⚠️ Two controls rather than one list of "Priority ↑ / Priority ↓"</h2>
 *
 * <p>A single menu holding every field twice is twice as long to read and makes reversing the order a
 * hunt through it. Field and direction are two decisions, and only the first of them is worth a menu.
 *
 * <p>⚠️ **Choosing a field resets the direction to that field's own default**, because the useful
 * direction differs per field — newest first for a date, A first for a name. Carrying the previous
 * field's direction across is how somebody lands on the oldest issues after asking for the newest.
 *
 * <p>It sits on the filter row beside the narrowing controls: filtering and ordering are the two things
 * somebody does to a list, and putting them in different places on the screen means hunting for one.
 */
export function IssueSortControl({
  options,
  sortId,
  direction,
  onChange,
  className,
}: {
  options: IssueSortOption[]
  sortId: string
  direction: SortDirection
  /** Both at once — a field change carries the new field's default direction with it. */
  onChange: (sortId: string, direction: SortDirection) => void
  className?: string
}) {
  const { t } = useLanguage()

  const chosen = findSort(sortId, options)
  const Arrow = direction === "desc" ? ArrowDownNarrowWide : ArrowUpNarrowWide

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Select
        value={chosen.id}
        onValueChange={(next) => onChange(next, findSort(next, options).defaultDirection)}
      >
        {/* ⚠️ `size="sm"` rather than `h-8`. Thirty-two pixels is neither of the toolkit's two heights,
            and this control sits on a row with a search box, three selects and a button — every one of
            which was a different height until they were all given the same word. */}
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder={t("issues.sort.placeholder", "Sort by")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {t("issues.sort.prefix", "Sort:")} {t(option.labelKey, option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={() => onChange(chosen.id, direction === "asc" ? "desc" : "asc")}
        // ⚠️ The label says which way it is, not what pressing it does. A control announced as "sort
        // descending" while the list is already descending is one nobody can read the state of.
        aria-label={
          direction === "asc"
            ? t("issues.sort.ascending", "Ascending — press to reverse")
            : t("issues.sort.descending", "Descending — press to reverse")
        }
        title={
          direction === "asc"
            ? t("issues.sort.ascending", "Ascending — press to reverse")
            : t("issues.sort.descending", "Descending — press to reverse")
        }
        className="flex size-[30px] shrink-0 items-center justify-center rounded-md border border-input bg-transparent text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Arrow className="size-4" />
      </button>
    </div>
  )
}

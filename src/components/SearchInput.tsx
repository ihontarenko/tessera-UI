import { Search } from "lucide-react"
import { Input } from "@jmouse/ui"
import { cn } from "@/lib/helpers"

interface SearchInputProperties {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /**
   * ⚠️ The toolkit's two heights, so a dense filter row does not hand-set one.
   *
   * `sm` is 30px and `default` is 34px; anything between them is a height the rest of the interface
   * does not have, which is how one row ends up reading as three toolkits. Match whatever sits beside
   * it — the buttons and selects take the same word.
   */
  size?: "sm" | "default"
  className?: string
}

// A search box for filtering an already-fetched list client-side (name/notes/etc. — the caller
// decides which fields). One shared piece so every list page's search+icon markup isn't
// copy-pasted eleven times; pair with `useDebouncedValue` so filtering a large list doesn't
// re-run on every keystroke. Not for server-side search — see TransactionsPage/SearchPage for that.
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  size = "default",
  className,
}: SearchInputProperties) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className={cn(
          "absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground",
          size === "sm" ? "left-2.5" : "left-3",
        )}
      />
      <Input
        size={size}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={size === "sm" ? "pl-8" : "pl-9"}
      />
    </div>
  )
}

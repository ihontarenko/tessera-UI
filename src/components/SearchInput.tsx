import { Search } from "lucide-react"
import { Input } from "@jmouse/ui"
import { cn } from "@/lib/helpers"

interface SearchInputProperties {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// A search box for filtering an already-fetched list client-side (name/notes/etc. — the caller
// decides which fields). One shared piece so every list page's search+icon markup isn't
// copy-pasted eleven times; pair with `useDebouncedValue` so filtering a large list doesn't
// re-run on every keystroke. Not for server-side search — see TransactionsPage/SearchPage for that.
export function SearchInput({ value, onChange, placeholder = "Search…", className }: SearchInputProperties) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-9"
      />
    </div>
  )
}

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import { ScrollArea, Skeleton } from "@jmouse/ui"
import { fetchFilterGrammar, type GrammarSection } from "@/api/savedFilters"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/helpers"

/** Warnings read differently from syntax, so the pitfalls section gets its own treatment. */
const PITFALLS = "pitfalls"

/** Whole expressions, not fragments — worth showing on their own line rather than in a syntax column. */
const EXAMPLES = "examples"

/**
 * The filter language reference, as shown behind the editor's help icon.
 *
 * The content is fetched, never written here: the server builds it from the same constants the
 * evaluator reports errors against, so the panel cannot tell an author about an accessor the engine
 * does not have. A cheat-sheet that has drifted is worse than none — it sends people hunting for a bug
 * in a correct expression.
 *
 * `onInsert` lets a click put a snippet straight into the expression field, which is the difference
 * between a reference someone reads and one they use.
 */
export function FilterHelpPanel({ onInsert }: { onInsert?: (syntax: string) => void }) {
  const { t } = useLanguage()
  const { data, isLoading } = useQuery({ queryKey: ["filter-grammar"], queryFn: fetchFilterGrammar })

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("filter.help.unavailable", "The syntax reference could not be loaded.")}
      </p>
    )
  }

  return (
    <ScrollArea className="h-[60vh] pr-3">
      <div className="space-y-5">
        {data.sections.map((section) => (
          <HelpSection key={section.id} section={section} onInsert={onInsert} />
        ))}
      </div>
    </ScrollArea>
  )
}

function HelpSection({ section, onInsert }: { section: GrammarSection; onInsert?: (syntax: string) => void }) {
  const { t } = useLanguage()
  const isPitfalls = section.id === PITFALLS
  const isExamples = section.id === EXAMPLES

  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        {isPitfalls && <AlertTriangle className="size-3.5 text-amber-500" />}
        {t(`filter.help.${section.id}`, section.title)}
      </h4>

      <ul className={cn("space-y-1.5", isPitfalls && "rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5")}>
        {section.entries.map((entry) => (
          <li
            key={entry.syntax}
            className={cn(
              "gap-2 text-xs",
              // An example is a full expression and wraps badly beside its description, so it stacks.
              isExamples || isPitfalls ? "flex flex-col" : "grid grid-cols-[minmax(0,11rem)_1fr] items-baseline",
            )}
          >
            {isPitfalls ? (
              <span className="font-medium">{entry.syntax}</span>
            ) : (
              <code
                className={cn(
                  "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] break-words",
                  onInsert && "cursor-pointer hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={onInsert ? () => onInsert(entry.syntax) : undefined}
                title={onInsert ? t("filter.help.insert", "Click to insert") : undefined}
              >
                {entry.syntax}
              </code>
            )}
            <span className="text-muted-foreground">{entry.explanation}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

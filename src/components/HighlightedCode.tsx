import { useEffect, useState } from "react"
import { cn } from "@/lib/helpers"
import { highlightToHtml, resolveParser } from "@/lib/codemirror/staticHighlight"

/**
 * A read-only block of code, coloured by the same grammar and the same palette as the editor.
 *
 * <h2>⚠️ Code that is not highlighted is code nobody reads carefully</h2>
 *
 * <p>The machinery for this already existed — `staticHighlight.ts` renders through the editor's own
 * {@link TESSERA_HIGHLIGHT_STYLE} precisely so a token is coloured identically whether it is being
 * written or read — and every screen outside rendered Markdown reached for a bare `<pre>` instead. The
 * policy projection is the one that suffers most for it: `jmpSyntax.ts` carries a whole `.jmp` grammar
 * whose stated purpose is "so a policy file picks up" this styling, and the one screen in the product
 * that shows a policy document would otherwise render it as undifferentiated grey, `deny` lines
 * included.
 *
 * <p>⚠️ **Plain text is the fallback, not an error.** A language the catalogue does not know resolves to
 * no parser and the block renders unhighlighted — which is the right outcome, and the reason nothing
 * here throws or warns.
 *
 * <p>⚠️ **The grammar is loaded lazily and the markup is built off it**, so this sets `innerHTML`. Every
 * character of `code` goes through `escapeHtml` in {@link highlightToHtml} before it lands in that
 * string; the spans are generated from token offsets, never from the content itself.
 */
export function HighlightedCode({
  code,
  language,
  className,
}: {
  code: string
  /** A fence name — `jmp`, `json`, `sql`. Unknown names render as plain text. */
  language: string
  className?: string
}) {
  const [highlighted, setHighlighted] = useState<string | null>(null)

  useEffect(() => {
    // ⚠️ The parser resolves asynchronously and `code` can change under it, so a late answer for a
    // previous block must not paint over the current one.
    let currentRequest = true

    setHighlighted(null)

    void resolveParser(language).then((parser) => {
      if (!currentRequest || !parser) {
        return
      }

      setHighlighted(highlightToHtml(parser, code))
    })

    return () => {
      currentRequest = false
    }
  }, [code, language])

  const shared = cn(
    "overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-[12px] leading-relaxed",
    className,
  )

  if (highlighted === null) {
    return <pre className={shared}>{code}</pre>
  }

  return <pre className={shared} dangerouslySetInnerHTML={{ __html: highlighted }} />
}

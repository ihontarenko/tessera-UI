import { LanguageDescription } from "@codemirror/language"
import { languages } from "@codemirror/language-data"
import type { Parser } from "@lezer/common"
import { highlightTree } from "@lezer/highlight"
import { StyleModule } from "style-mod"
import { TESSERA_HIGHLIGHT_STYLE } from "./highlightStyle"
import { jmpSyntaxLanguage } from "./jmpSyntax"

/**
 * Highlighting for a fenced block that is being *read* rather than edited — there is no CodeMirror
 * view behind a rendered issue description, and this is what stands in for one.
 *
 * <p>It reuses the exact pieces the editor uses, which is the whole point:
 *
 * <ul>
 *   <li>the grammars — every language lazy-loaded from `@codemirror/language-data` and cached, so a
 *       document containing no code costs nothing and one containing SQL loads only SQL;</li>
 *   <li>the palette — the same {@link TESSERA_HIGHLIGHT_STYLE}. Rendering through the *same*
 *       `HighlightStyle` (rather than the built-in `classHighlighter`, whose tag→class coverage
 *       differs) is what guarantees a token is coloured identically here and in the editor. There is
 *       no view to mount its generated stylesheet, so we mount it ourselves, once.</li>
 * </ul>
 */

/** Resolved parsers by normalised language name; `null` marks a language with no known grammar. */
const parserCache = new Map<string, Parser | null>()

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

let highlightStylesMounted = false

/** Mount the shared highlight stylesheet once, so its generated token classes have colours here too. */
function ensureHighlightStyles(): void {
  if (highlightStylesMounted || typeof document === "undefined") {
    return
  }
  if (TESSERA_HIGHLIGHT_STYLE.module) {
    StyleModule.mount(document, TESSERA_HIGHLIGHT_STYLE.module)
  }
  highlightStylesMounted = true
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character])
}

/** The three fence names a policy turns up under — Innoventa's manual uses all of them. */
function isPolicyLanguage(name: string): boolean {
  return name === "jmp" || name === "jmouse-policy" || name === "policy"
}

/** Render `code` to an HTML string of highlighted `<span>` runs using the given Lezer parser. */
export function highlightToHtml(parser: Parser, code: string): string {
  ensureHighlightStyles()

  const tree = parser.parse(code)
  let html = ""
  let position = 0

  highlightTree(tree, TESSERA_HIGHLIGHT_STYLE, (from, to, classes) => {
    if (from > position) {
      html += escapeHtml(code.slice(position, from))
    }
    html += `<span class="${classes}">${escapeHtml(code.slice(from, to))}</span>`
    position = to
  })

  if (position < code.length) {
    html += escapeHtml(code.slice(position))
  }

  return html
}

/**
 * Resolve a fenced-block language name to a Lezer parser, loading it once and caching the answer.
 *
 * <p>Returns `null` for a language the catalogue does not know, so the caller falls back to plain,
 * unhighlighted code — which is the right outcome. A missing grammar is not an error worth telling
 * somebody reading an issue about.
 */
export async function resolveParser(languageName: string): Promise<Parser | null> {
  const normalized = languageName.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  // ⚠️ Synchronously, and ahead of the catalogue: `.jmp` is not a language CodeMirror ships, so an
  // issue quoting a policy would otherwise render the one document whose `deny` line must never be
  // skimmed past as undifferentiated grey. See `./tags` for why a tracker carries this at all.
  if (isPolicyLanguage(normalized)) {
    return jmpSyntaxLanguage.parser
  }
  if (parserCache.has(normalized)) {
    return parserCache.get(normalized) ?? null
  }

  const description = LanguageDescription.matchLanguageName(languages, normalized, true)
  if (!description) {
    parserCache.set(normalized, null)
    return null
  }

  const support = await description.load()
  const parser = support.language.parser
  parserCache.set(normalized, parser)
  return parser
}

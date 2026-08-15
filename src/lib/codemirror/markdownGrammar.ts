import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { syntaxHighlighting } from "@codemirror/language"
import { languages } from "@codemirror/language-data"
import type { Extension } from "@codemirror/state"
import { TESSERA_HIGHLIGHT_STYLE } from "./highlightStyle"
import { TESSERA_EDITOR_THEME } from "./editorTheme"
import { jmpLanguageDescription } from "./jmpSyntax"

/**
 * What turns the description editor from a grey textarea into something that shows structure while it
 * is being typed: the Markdown grammar, the shared palette, and the chrome around them.
 *
 * <p>`codeLanguages` is the catalogue rather than a fixed list, so a ` ```sql ` fence inside a
 * description is parsed by the SQL grammar — lazily, loaded the first time one appears. Written the
 * other way round, every grammar CodeMirror knows would be in the initial bundle for the sake of a
 * fence most issues do not contain.
 *
 * <p>⚠️ **`jmp` goes in front of the catalogue**, because it is not in it: CodeMirror has never heard
 * of jMouse Policy, and a ticket about authorization is exactly a ` ```jmp ` fence. Same grammar the
 * static highlighter resolves, so a policy reads identically typed and saved — see `./tags` for why a
 * tracker paints another product's language at all.
 *
 * <p>⚠️ **`;;;mermaid` stays plain in the source editor.** Innoventa's copy carries a bespoke block
 * parser for `;;;` directives, and almost all of it exists to nest its expression language inside
 * one. Tessera has no language to nest — a mermaid body is mermaid, which CodeMirror has no grammar
 * for either way — so the parser would buy a fence mark in a different colour and nothing else. The
 * preview is what tells an author whether a diagram is right, and that is a click away.
 */
export const TESSERA_MARKDOWN_GRAMMAR: readonly Extension[] = [
  markdown({ base: markdownLanguage, codeLanguages: [jmpLanguageDescription, ...languages] }),
  syntaxHighlighting(TESSERA_HIGHLIGHT_STYLE),
  TESSERA_EDITOR_THEME,
]

import { languages } from "@codemirror/language-data"
import { editorChrome } from "@jmouse/codemirror/editor"
import {
  createStaticHighlighter,
  MAPPING_LANGUAGE,
  POLICY_LANGUAGE,
  QUERY_LANGUAGE,
  SYNTAX_HIGHLIGHT_STYLE,
} from "@jmouse/codemirror/highlight"
import { markdownGrammar } from "@jmouse/codemirror/markdown"

/**
 * Tessera's CodeMirror configuration — which grammars it answers for, and what the source editor is
 * dressed in. The grammars, the palette and the machinery are `@jmouse/codemirror`'s; the choices below
 * are the product's, and they are the whole of what used to be six near-identical files.
 *
 * <h2>⚠️ Why a tracker carries another product's language at all</h2>
 *
 * <p>Because a tracker's job is holding text *about* other systems, and a ticket about Innoventa's
 * authorization is a ` ```jmp ` fence. The earlier reasoning — "jmp is Innoventa's domain, so it stays
 * out" — was the wrong test: it is the test for whether Tessera should *evaluate* a policy, not for
 * whether it should be able to show one. A manual that documents a language in plain grey while an
 * editor two clicks away colours it has failed at one job.
 *
 * <p>⚠️ **This colours; it does not decide.** Whether a policy is valid is answered by Innoventa's
 * parser and never here — Tessera has no opinion about a policy beyond how it reads.
 *
 * <p>The same test admits a saved view (` ```jmq `) and a mapping file (` ```jmm `): a ticket describing
 * either is one of the commonest things written here, and a fence nobody can read is a description that
 * has to be re-explained in the comments.
 *
 * <p>⚠️ **The expression language is deliberately absent.** jME is only worth colouring where there is
 * something to evaluate, and there is nothing here — a `jmq` or `jmm` fence carries its expression half
 * inside its own grammar, so nothing is lost by leaving jME itself off this list.
 *
 * <p>⚠️ **A dialect missing from this list does not fail — it renders as plain text.** The catalogue is
 * asked next, it has never heard of any of them, and the fence comes out grey. That is indistinguishable
 * on screen from a fence somebody mislabelled, so it is checked here rather than reported by anything.
 */
export const { highlightToHtml, resolveParser } = createStaticHighlighter({
  highlightStyle: SYNTAX_HIGHLIGHT_STYLE,
  grammars: [POLICY_LANGUAGE, QUERY_LANGUAGE, MAPPING_LANGUAGE],
  catalogue: languages,
})

/** The description editor's stack: the Markdown grammar, the shared palette, and the chrome. */
export const TESSERA_MARKDOWN_GRAMMAR = markdownGrammar({
  highlightStyle: SYNTAX_HIGHLIGHT_STYLE,
  chrome: editorChrome(),
  codeLanguages: languages,
})

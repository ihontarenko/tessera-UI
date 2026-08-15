import { EditorView } from "@codemirror/view"

/**
 * The CodeMirror chrome — background, caret, selection, placeholder — mapped onto Tessera's own
 * tokens, so the source surface sits inside the page rather than on top of it and recolours with the
 * theme. Syntax colours live in {@link ./highlightStyle}; this is only the frame around them.
 *
 * <p>⚠️ Written in shadcn's names (`--foreground`, `--primary`) rather than the vendored library's
 * bridged ones (`--ink`, `--brand`). This file is Tessera's, not a copy of anything, so it has no
 * reason to speak through the bridge — and one fewer indirection is one fewer thing to keep in sync.
 */
export const TESSERA_EDITOR_THEME = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "transparent",
    height: "100%",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8125rem",
    padding: "10px 12px",
    caretColor: "var(--primary)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--primary)",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "color-mix(in srgb, var(--primary) 26%, transparent)",
  },
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
  },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
    outline: "1px solid color-mix(in srgb, var(--primary) 42%, transparent)",
  },
})

import type { CSSProperties } from "react"
import {
  Dialog,
  dialogActionPlugin,
  MarkdownEditor,
  MarkdownRenderer,
  MarkdownUiProvider,
} from "@jmouse/markdown"
import type { MarkdownPlugin } from "@jmouse/markdown"
import { TESSERA_MARKDOWN_UI } from "@/components/markdown/tesseraUiKit"
import {
  FAST_PREVIEW_ACTION,
  TESSERA_READER_PLUGINS,
  TESSERA_TOOLBAR,
  TESSERA_WRITING_PLUGINS,
} from "@/components/markdown/tesseraMarkdownStack"
import { cn } from "@/lib/helpers"
// The library's own stylesheet first, then the bridge that gives it its colours.
import "@jmouse/markdown/styles.css"
import "@/components/markdown/markdown.css"

/**
 * Tessera's Markdown, as one component each for reading and writing. What a document may contain and
 * what the toolbar offers live in {@link ../markdown/tesseraMarkdownStack}; this file mounts them.
 *
 * <h2>⚠️ `tessera-markdown` is not decoration — it is the token bridge</h2>
 *
 * <p>The vendored library defines no colours at all: it reads `--paper`, `--line`, `--ink-*` and
 * `--accent` from whatever host it is dropped into. Tessera renamed that vocabulary onto shadcn's when
 * the palettes were ported, so those lookups resolved to nothing and the editor rendered as an
 * invisible frame around an unstyled textarea. `markdown.css` bridges them, scoped to this class —
 * scoped rather than global because these are a vendored library's names, not this application's.
 *
 * <p>Every surface the library paints therefore has to carry it, including the ones that leave this
 * subtree: the toolbar's dialogs are portalled to `document.body`, which is why
 * {@link TESSERA_MARKDOWN_UI}'s `Modal` puts the class on its own content.
 */

/*
 * ⚠️ A LIBRARY FINDING, recorded here because it is where somebody will look for the fix.
 *
 * `README.md` says a read-only surface "needs no toolbar and no CodeMirror". In this application it
 * gets both, and no amount of care on this side changes that:
 *
 *   - `core/index.ts` STATICALLY re-exports `MarkdownEditor`, and `index.ts` re-exports all of `core`.
 *   - So importing `MarkdownRenderer` from the published barrel pulls the editor's module graph —
 *     @codemirror/state, @codemirror/view and @uiw/react-codemirror — into whichever chunk reads a
 *     document. That is every issue page, and an issue is read far more often than it is written.
 *   - Wrapping the editor in `lazy(() => import(…))` does nothing. Rolldown says so outright:
 *     "INEFFECTIVE_DYNAMIC_IMPORT: … is dynamically imported but also statically imported by
 *     src/markdown/core/index.ts". Measured twice — through the barrel and through the module — and the
 *     main bundle moved by 300 bytes both times.
 *
 * The two ways out are both somebody else's decision. The library could stop re-exporting the editor
 * from the barrel and publish it at its own path, which is a one-line change there and the right one;
 * or a host could bypass the published surface and import every renderer-side module by path, which
 * trades a bundle for a coupling to the library's internal layout and would silently break on any
 * reorganisation.
 *
 * Left eager, deliberately, rather than dressed in `lazy()` machinery that provably does not split. A
 * split that does not split is worse than none: it reads as solved.
 */

/**
 * A document, read.
 *
 * <p>⚠️ **Reader plugins only** — no palettes, no dialogs, no insert machinery. A surface somebody may
 * read and not write pays for nothing it cannot use, which is most surfaces.
 */
export function TesseraMarkdown({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) {
  return (
    <MarkdownRenderer
      markdown={markdown}
      plugins={TESSERA_READER_PLUGINS}
      context={undefined}
      className={cn("tessera-markdown prose-tessera", className)}
    />
  )
}

/**
 * The whole document, rendered full-width in a modal, for as long as it is being looked at.
 *
 * <p>⚠️ **This replaces the library's side-by-side preview rather than joining it.** The split is
 * right where the editor owns the page, which is what it was written for; a description sits in a
 * column beside the issue rail, and halving that column leaves neither half worth reading. So the
 * editor is configured with no `preview` at all — which is also why `PREVIEW_TOGGLE_ACTION` never
 * registers, and the toolbar names this instead.
 *
 * <p>It lives here rather than in the stack because it is the one plugin that needs the renderer to
 * preview *with*, and that is the component directly above.
 */
const fastPreviewPlugin = dialogActionPlugin({
  id: FAST_PREVIEW_ACTION,
  label: "⚡ Preview",
  title: "Preview the whole document",
  dialog: ({ editor, close }) => (
    <Dialog title="Preview" width={880} onClose={close}>
      <div className="max-h-[70vh] overflow-y-auto">
        <TesseraMarkdown markdown={editor.getValue()} />
      </div>
    </Dialog>
  ),
})

/**
 * ⚠️ Built once, at module scope — the library's first rule, since it mounts one provider per
 * data-bearing plugin and a list rebuilt between renders changes hook order.
 */
const TESSERA_EDITOR_PLUGINS = [
  ...TESSERA_WRITING_PLUGINS,
  fastPreviewPlugin,
] as readonly MarkdownPlugin<undefined>[]

/**
 * A document, written: the source, and a toolbar over it.
 *
 * <p>The editor asks the host for its widgets — it ships no buttons, inputs or modals of its own — so
 * every dialog it opens is built out of Tessera's, and there is no second design system to drift from
 * the first. {@link TESSERA_MARKDOWN_UI} is that binding.
 *
 * <p>The preview resolves issue references too: it renders through the same {@link TesseraMarkdown}
 * the page uses, so a `TES-42` typed a moment ago looks exactly as it will once saved.
 */
export function TesseraMarkdownEditor({
  value,
  onChange,
  placeholder,
  /** How tall the source surface stands. A description wants less room than a page. */
  height = "15rem",
}: {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  height?: string
}) {
  return (
    <MarkdownUiProvider kit={TESSERA_MARKDOWN_UI}>
      <div className="tessera-markdown" style={{ "--markdown-editor-height": height } as CSSProperties}>
        <MarkdownEditor
          value={value}
          onChange={onChange}
          plugins={TESSERA_EDITOR_PLUGINS}
          context={undefined}
          toolbar={TESSERA_TOOLBAR}
          placeholder={placeholder}
        />
      </div>
    </MarkdownUiProvider>
  )
}

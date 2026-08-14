import {
  calloutPlugin,
  gfmPlugin,
  MarkdownEditor,
  MarkdownRenderer,
  MarkdownUiProvider,
  mathPlugin,
  mermaidPlugin,
} from "@/markdown"
import { IssueReferenceProvider, issueReferencePlugin } from "@/components/markdown/issueReference"
import { TESSERA_MARKDOWN_UI } from "@/components/markdown/tesseraUiKit"

/**
 * Tessera's Markdown, as one component each for reading and writing.
 *
 * <h2>The plugin list, and what is deliberately not in it</h2>
 *
 * | Installed | Why |
 * |---|---|
 * | `gfm` | tables, task lists, strikethrough — what people already write |
 * | `callouts` | `:::note`, `:::warning` — a spec needs to raise its voice occasionally |
 * | `math` | `$$…$$`, because estimates and formulas turn up in specs |
 * | `mermaid` | `;;;mermaid` — a flow somebody would otherwise draw elsewhere and paste as an image |
 * | `issue-reference` | `TES-42` becomes a live link — the one construct this product added |
 *
 * Not installed, and each for a reason rather than an oversight: `wavedrom` and `jme` are Innoventa's
 * electronics and form-engine domains and are not even in this copy (see `@/markdown/README.md`), and
 * the resource pickers resolve that product's files and pages — Tessera's equivalents are an issue
 * link, which the reference plugin already gives, and attachments, which this product does not have
 * yet. A picker for a resource that does not exist is a button that always disappoints.
 *
 * ⚠️ **The list is built at module scope**, which is the library's first rule: it mounts one provider
 * per data-bearing plugin, so a list rebuilt between renders changes hook order. The same goes for
 * `context`, which is why there is none — nothing here varies per surface.
 */
const PLUGINS = [
  gfmPlugin(),
  calloutPlugin(),
  mathPlugin(),
  mermaidPlugin(),
  issueReferencePlugin(),
]

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
 * ⚠️ **No editor, no toolbar, no CodeMirror.** A surface somebody may read and not write pays for
 * nothing it cannot use — which is most surfaces, since an issue is read far more often than it is
 * edited.
 */
export function TesseraMarkdown({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) {
  return (
    <IssueReferenceProvider markdown={markdown}>
      <MarkdownRenderer
        markdown={markdown}
        plugins={PLUGINS}
        context={undefined}
        className={className ?? "prose-tessera"}
      />
    </IssueReferenceProvider>
  )
}

/**
 * A document, written.
 *
 * <p>The editor asks the host for its widgets — it ships no buttons, inputs or modals of its own — so
 * every dialog it opens is built out of Tessera's, and there is no second design system to drift from
 * the first. {@link TESSERA_MARKDOWN_UI} is that binding.
 *
 * <p>⚠️ The live preview resolves issue references too: the provider wraps both halves, so a mention
 * typed a moment ago looks in the preview exactly as it will on the page.
 */
export function TesseraMarkdownEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
}) {
  return (
    <MarkdownUiProvider kit={TESSERA_MARKDOWN_UI}>
      <IssueReferenceProvider markdown={value}>
        <MarkdownEditor
          value={value}
          onChange={onChange}
          plugins={PLUGINS}
          context={undefined}
          placeholder={placeholder}
        />
      </IssueReferenceProvider>
    </MarkdownUiProvider>
  )
}

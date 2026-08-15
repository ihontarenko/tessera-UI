import {
  blockPickerPlugin,
  calloutPlugin,
  codeHighlightPlugin,
  FORMAT_ACTION_IDS,
  gfmPlugin,
  imageInsertPlugin,
  linkPlugin,
  mathPlugin,
  mermaidPlugin,
  rowToggle,
  snippetPickerPlugin,
  tablePlugin,
  TOOLBAR_SPACER,
} from "@/markdown"
import type {
  BlockDescriptor,
  Highlighter,
  MarkdownPlugin,
  SnippetTemplate,
  ToolbarLayout,
} from "@/markdown"
import { issueReferencePlugin } from "@/components/markdown/issueReference"
import { TESSERA_MARKDOWN_GRAMMAR } from "@/lib/codemirror/markdownGrammar"
import { highlightToHtml, resolveParser } from "@/lib/codemirror/staticHighlight"

/** Highlights a fenced block with the shared grammars; an unknown language stays plain. */
const tesseraHighlighter: Highlighter = async (language, code) => {
  const parser = await resolveParser(language)
  return parser ? highlightToHtml(parser, code) : null
}

/**
 * Markdown highlighting for the source editor.
 *
 * <p>A plugin with no renderer and no toolbar action — the library takes CodeMirror extensions from
 * plugins exactly as it takes constructs from them, so the grammar arrives the same way everything
 * else does rather than through a prop on the editor.
 */
function markdownGrammarPlugin(): MarkdownPlugin<unknown> {
  return { name: "markdown-grammar", editorExtensions: TESSERA_MARKDOWN_GRAMMAR }
}

/**
 * Tessera's Markdown stack: what a document may contain, and what the toolbar offers for putting it
 * there.
 *
 * <p>The library is a CommonMark engine with two block shapes and no opinions — every construct and
 * every button arrives as a plugin named here. This file is the whole of what this product configures;
 * `TesseraMarkdown.tsx` is only the two components that mount it.
 *
 * <h2>Two lists, because reading and writing are not the same job</h2>
 *
 * <p>A reader needs the constructs. A writer needs those *plus* the palettes and dialogs for inserting
 * them, which is code and modal markup nobody reading an issue should pay for. An issue is read far
 * more often than it is edited, so the split is the common case winning.
 *
 * <p>⚠️ **Both lists are built at module scope**, which is the library's first rule: it mounts one
 * provider per data-bearing plugin, so a list rebuilt between renders changes hook order.
 */

/**
 * What a document can contain.
 *
 * | Installed | Why |
 * |---|---|
 * | `gfm` | tables, task lists, strikethrough — what people already write |
 * | `callouts` | `:::note`, `:::warning` — a spec needs to raise its voice occasionally |
 * | `math` | `$$…$$`, because estimates and formulas turn up in specs |
 * | `mermaid` | `;;;mermaid` — a flow somebody would otherwise draw elsewhere and paste as an image |
 * | `issue-reference` | `TES-42` becomes a live link — the one construct this product added |
 * | `codeHighlight` | a fenced block reads as code rather than as grey text |
 *
 * <p>Not installed, and each for a reason rather than an oversight: `wavedrom` and `jme` are
 * Innoventa's electronics and form-engine domains and are not even in this copy (see
 * `@/markdown/README.md`).
 *
 * <p>⚠️ **`externalLink` is deliberately absent** even though a tracker wants outward links in a new
 * tab. It and `issueReferencePlugin` both claim the `a` component, so installing both means one
 * silently losing — and the reference plugin is the one this product cannot do without. Its own
 * fallback `<a>` carries `target="_blank"` instead, which is the same outcome with nothing to collide.
 */
export const TESSERA_READER_PLUGINS: readonly MarkdownPlugin<undefined>[] = [
  gfmPlugin(),
  calloutPlugin(),
  mathPlugin(),
  mermaidPlugin(),
  codeHighlightPlugin({ highlight: tesseraHighlighter }),
  issueReferencePlugin(),
] as readonly MarkdownPlugin<undefined>[]

/**
 * The blocks the `:::` palette offers.
 *
 * <p>Every entry is claimed by one of the reader plugins above — a palette that can insert something
 * the renderer does not understand is a button that produces grey text. `youtube` is not here for
 * exactly that reason: this copy does not install the plugin that renders it.
 */
export const TESSERA_BLOCKS: readonly BlockDescriptor[] = [
  { name: "note", label: "Note callout", hint: "message text", example: "Blocked on the API contract." },
  { name: "tip", label: "Tip callout", hint: "message text", example: "Run it against staging first." },
  { name: "warning", label: "Warning callout", hint: "message text", example: "Breaks every saved filter." },
  { name: "info", label: "Info callout", hint: "message text", example: "Agreed in the 3 March review." },
]

/** Scaffolds for the two constructs nobody remembers the syntax of. */
export const TESSERA_SNIPPETS: readonly SnippetTemplate[] = [
  {
    key: "mermaid-flow",
    label: "Flowchart",
    hint: "boxes and arrows — rendered in the browser",
    ownLine: true,
    template:
      ";;;mermaid\n" +
      "graph TD\n" +
      "  A[Reported] --> B{Reproducible?}\n" +
      "  B -->|yes| C[Fix]\n" +
      "  B -->|no| D[Ask for steps]\n" +
      ";;;",
  },
  {
    key: "mermaid-sequence",
    label: "Sequence diagram",
    hint: "who calls whom, in order",
    ownLine: true,
    template:
      ";;;mermaid\n" +
      "sequenceDiagram\n" +
      "  Browser->>API: POST /issues\n" +
      "  API->>Database: insert\n" +
      "  API-->>Browser: 201 TES-42\n" +
      ";;;",
  },
  {
    key: "mermaid-state",
    label: "State diagram",
    hint: "a workflow, drawn",
    ownLine: true,
    template:
      ";;;mermaid\n" +
      "stateDiagram-v2\n" +
      "  [*] --> ToDo\n" +
      "  ToDo --> InProgress\n" +
      "  InProgress --> Done\n" +
      "  Done --> [*]\n" +
      ";;;",
  },
  {
    key: "math-block",
    label: "Math block",
    hint: "centred display formula (KaTeX)",
    ownLine: true,
    template: "$$\n\\text{velocity} = \\frac{\\sum \\text{points}}{\\text{sprints}}\n$$",
  },
]

/**
 * Everything a reader gets, plus the dialogs and palettes for writing it.
 *
 * <p>The link and image dialogs are given no resource sources: Tessera has no attachments and no page
 * tree, so both offer their URL tab and nothing else. An issue link needs no picker either — typing
 * `TES-42` is already the shortest route there is.
 *
 * <p>⚠️ **Not the whole editor list.** The fast-preview dialog is the one plugin that cannot be
 * assembled here, because it needs the renderer to preview *with* — it is added in
 * `TesseraMarkdown.tsx`, beside the component it renders.
 */
export const TESSERA_WRITING_PLUGINS: readonly MarkdownPlugin<undefined>[] = [
  ...TESSERA_READER_PLUGINS,
  markdownGrammarPlugin(),
  linkPlugin(),
  imageInsertPlugin(),
  tablePlugin(),
  blockPickerPlugin({ blocks: TESSERA_BLOCKS, trigger: /^:::$/ }),
  snippetPickerPlugin({
    id: "diagram",
    label: "📈 Diagram / math",
    title: "Insert a diagram or formula",
    templates: TESSERA_SNIPPETS,
  }),
] as readonly MarkdownPlugin<undefined>[]

/** The id the fast-preview plugin registers under, named by the toolbar and defined next to the renderer. */
export const FAST_PREVIEW_ACTION = "preview.modal"

/**
 * Where each button sits: the constructs on one row, the formatting shortcuts behind a toggle on a
 * second.
 *
 * <p>Twelve format buttons open by default would be a wall of glyphs above a field somebody wanted to
 * type one sentence into — and anybody reaching for `**bold**` already knows how to type it. The row
 * is there for the person who does not.
 *
 * <p>⚠️ **Preview is a modal, not the library's side-by-side split.** The split is right where the
 * editor owns the page; a description sits in a column beside the issue rail, and halving that column
 * leaves neither half worth reading. The whole document, full width, for as long as it is being
 * looked at — then gone.
 */
export const TESSERA_TOOLBAR: ToolbarLayout = [
  [
    "link",
    "image",
    "block-picker",
    "diagram",
    rowToggle("format", "✎ Format", "Markdown formatting shortcuts"),
    TOOLBAR_SPACER,
    FAST_PREVIEW_ACTION,
  ],
  { id: "format", hidden: true, actions: [...FORMAT_ACTION_IDS, "table"] },
]

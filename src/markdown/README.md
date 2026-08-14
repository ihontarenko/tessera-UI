# `@/markdown` — a plugin-driven Markdown renderer and editor

> ## ⚠️ This is a COPY. Read this before editing anything in it.
>
> **Where it came from:** `Innoventa/UI/src/markdown`, at commit `06811e0` (2026-08-14).
>
> **Why a copy and not a package.** `Innoventa/UI` and `Tessera/UI` are separate repositories with no
> package registry between them, so the honest options were a copy or extracting an npm package. A copy
> is right *for now*: one consumer becoming two is the moment you find out what is actually generic, and
> extracting before that is guessing. This paragraph exists because **the second copy is how two of them
> silently diverge** — if you fix something here that is also wrong there, say so in both.
>
> **The claim above was tested and it held.** The tree imports eight npm packages and not one file of
> Innoventa's, so it moved across unchanged apart from the two deletions below. That is the finding this
> copy was worth making.
>
> ### The two things Tessera dropped, and why
>
> | Dropped | Why |
> |---|---|
> | `plugins/jme/` | The expression language is Innoventa's form engine. An evaluator with nothing to evaluate is a foreign domain's code shipped to a tracker. |
> | `plugins/diagrams/WavedromDiagram.tsx` and `wavedromPlugin` | Timing diagrams are that product's electronics domain — and the renderer dynamically imports `wavedrom` and `json5`, which Vite resolves at **build** time, so keeping it would mean installing two packages to render a construct nobody here writes. |
>
> Nothing else differs. A re-sync from Innoventa is therefore an overwrite plus these two deletions,
> which is why they are listed rather than merely done.
>
> ### ⚠️ And a document survives the crossing
>
> Unclaimed syntax stays prose — the rule stated further down is what makes this survivable. A
> `;;;wavedrom` fence or a `:::jme` block written in Innoventa and pasted here renders as readable text
> rather than breaking the document. That is a property worth checking after any change to the parser,
> not one to assume.

A self-contained Markdown stack. It knows CommonMark, two block shapes, and nothing else.

Everything beyond that — diagrams, maths, live data, applets, syntax highlighting, every toolbar
button, every dialog, every endpoint it talks to — arrives as a **plugin you construct and hand in**.
There is no `enableJme` flag, no hard-coded API path, no imported design system. Configure it, don't
fork it.

It lives inside this repository but depends on nothing in it. Tessera is a *consumer*: see
`src/components/markdown/` for what a host adapter looks like — the seven-component UI kit bound to
this product's own widgets, and the list of plugins it chooses to install.

**Dependencies:** React, CodeMirror 6, `react-markdown`. Individual plugins add their own
(`mermaid`, `katex`, `remark-gfm`), and a plugin you don't install costs nothing.

---

## The idea

```
                 ┌──────────── plugins you pass in ────────────┐
document ──►  parse  ──►  resolve  ──►  render                 │
              (claimed  (each plugin  (each plugin draws       │
               names)    batches its   its own blocks)         │
                         own data)                             │
                 └─────────────────────────────────────────────┘
```

A plugin may fill any subset of six slots, and they are orthogonal:

| Slot | What it contributes |
|---|---|
| `claims` | the `:::name` / `;;;name` constructs it owns |
| `renderBlock` | how one of its blocks draws |
| `useBlockData` | one batched fetch for every block it claims in the document |
| `prose` | remark/rehype plugins, element overrides, a source pre-pass |
| `actions` + `triggers` | toolbar buttons and the prefixes that open them |
| `editorExtensions` / `useEditorExtensions` | CodeMirror grammars, keymaps, themes |

Syntax nobody claims stays prose. Drop a plugin and its construct quietly turns back into text
instead of breaking the document — which is what makes one document portable across products.

---

## Rendering

```tsx
import { MarkdownRenderer, gfmPlugin, mathPlugin, mermaidPlugin, calloutPlugin } from '@/markdown';

// Build the list once. It must be stable across renders — module scope, or useMemo.
const PLUGINS = [gfmPlugin(), mathPlugin(), mermaidPlugin(), calloutPlugin()];

export function Article({ markdown }: { markdown: string }) {
    return <MarkdownRenderer markdown={markdown} plugins={PLUGINS} context={undefined} className="prose"/>;
}
```

That is a complete, working renderer: tables, `$$maths$$`, `;;;mermaid` diagrams and `:::note`
callouts. No provider, no configuration, no network.

### `context`

Ambient information every plugin receives on each render — the host decides what it means. Innoventa
passes the *surface* a document is being read on (in-app, public share, inert preview), which is how
one plugin list serves an authenticated page and a signed-out one:

```tsx
const context = useMemo(() => ({ signedIn }), [signedIn]);   // keep it stable!
<MarkdownRenderer markdown={markdown} plugins={PLUGINS} context={context}/>
```

Keeping it stable matters: plugins memoise their per-context configuration, and a context rebuilt
every render would rebuild an evaluator every render.

---

## Editing

The editor needs one more thing: **your widgets**. It ships no buttons, inputs or modals — its dialogs
ask the host for them, so they inherit your themes and never drift into a second design system.

```tsx
import {
    MarkdownEditor, MarkdownUiProvider, FORMAT_ACTION_IDS, PREVIEW_TOGGLE_ACTION,
    TOOLBAR_SPACER, rowToggle, linkPlugin, tablePlugin,
} from '@/markdown';

const PLUGINS = [...READER_PLUGINS, linkPlugin(), tablePlugin()];

const TOOLBAR = [
    ['link', 'table', rowToggle('format', '✎ Format'), TOOLBAR_SPACER, PREVIEW_TOGGLE_ACTION],
    { id: 'format', hidden: true, actions: FORMAT_ACTION_IDS },
];

<MarkdownUiProvider kit={MY_UI_KIT}>
    <MarkdownEditor
        value={content}
        onChange={setContent}
        plugins={PLUGINS}
        context={context}
        toolbar={TOOLBAR}
        preview={{ className: 'prose' }}
    />
</MarkdownUiProvider>
```

### The toolbar is names, not components

Rows list **action ids**. Plugins contribute actions without knowing where they will sit; you arrange
rows without knowing how any action works. A name with no registered action is skipped silently, so
one layout survives across products with different plugin sets.

`FORMAT_ACTIONS` (bold, italic, headings, lists, quote, code) are built in — they need no plugin,
because they need no knowledge beyond "this is Markdown".

### The UI kit

Seven components, each a thin translation from the library's small prop shape to yours:

```tsx
const MY_UI_KIT: MarkdownUiKit = {
    Modal:    ({ title, width, onClose, footer, tabBar, children }) => …,
    Button:   ({ variant, disabled, onClick, children }) => …,
    Input:    ({ value, onChange, placeholder, type, autoFocus, ariaLabel }) => …,
    Select:   ({ value, onChange, options }) => …,
    Textarea: ({ value, onChange, rows, placeholder }) => …,
    Tabs:     ({ value, onChange, tabs }) => …,
    Field:    ({ label, hint, children }) => …,
};
```

Only dialogs need it. A read-only `MarkdownRenderer` never asks.

---

## Configuring the shipped plugins

### The applet plugin — point it at your evaluator

```ts
import { jmePlugin, fetchEvaluator } from '@/markdown';

// Declaratively, from a URL that takes { code, variables } and answers { mode, result }:
jmePlugin({ evaluator: () => fetchEvaluator('/api/jme/execute') })

// Or through your own client, so it inherits auth and token refresh:
jmePlugin({
    evaluator:     (context) => context.signedIn ? privateEvaluator : publicEvaluator,
    resolveInput:  (context) => context.signedIn ? MyTypedFieldInput : undefined,
    bindingSource: FIELD_SOURCE,
})
```

`resolveInput` decides what a bound input looks like — plain text boxes by default, your own typed
controls where they're reachable. `bindingSource` is where the insert dialog finds bindable values.

### Pickers — a URL and a mapper

Anything a dialog can reach outside the document goes through one small port: a name and a search
function. `httpResource` is the declarative half.

```ts
import { httpResource, imageInsertPlugin, linkPlugin, matchesQuery } from '@/markdown';

const IMAGES = httpResource({
    id:    'files',
    label: 'From files',
    url:   (query) => `/api/files?search=${encodeURIComponent(query)}`,
    map:   (payload) => payload.items.map((file) => ({
        id: file.id, label: file.name, value: file.url, kind: file.mimeType,
    })),
});

// Or hand over a function, when you already have a client worth using:
const PAGES = {
    id: 'pages', label: 'Pages',
    search: async (query) => (await pagesApi.list(undefined, query)).data.map(toItem),
};

imageInsertPlugin({ sources: [IMAGES] });
linkPlugin({ sources: [PAGES] });
```

Items are the only thing the library ever sees — never a payload, an endpoint, or a client.

### Live data blocks — a loader and a renderer

```tsx
import { dataBlockPlugin, promiseLoader } from '@/markdown';

dataBlockPlugin({
    directives: ['stock', 'part', 'bom'],
    load:       promiseLoader((requests) => fetch('/api/blocks/resolve', {
                    method: 'POST', body: JSON.stringify(requests),
                }).then((response) => response.json())),
    render:     ({ block, data, status }) => …,
});
```

`promiseLoader` refetches only when the *set of blocks* changes, so typing prose around a `:::stock`
doesn't hit the network. Already have React Query? Pass your own hook as `load` instead — that's the
contract, and it's what Innoventa does so the editor's live preview reuses resolved blocks.

### Highlighting — bring your own

```ts
codeHighlightPlugin({
    highlight: async (language, code) => myHighlighter(language, code) ?? null,
});
```

Without it, fenced code renders plain. That's a legitimate choice, not a degraded one.

---

## Writing a plugin

A plugin is a plain object. A factory function gives it its configuration.

**A block that renders itself:**

```tsx
export function tweetPlugin(options: { theme: 'light' | 'dark' }) {
    return {
        name:        'tweet',
        claims:      [{ shape: 'line', name: 'tweet' }],   // :::tweet <id>
        renderBlock: ({ block }) => <Tweet id={block.body} theme={options.theme}/>,
    };
}
```

**A block that fetches, batched across the whole document:**

```tsx
export function weatherPlugin(options: { endpoint: string }) {
    return {
        name:   'weather',
        claims: [{ shape: 'line', name: 'weather' }],       // :::weather Kyiv
        useBlockData(blocks) {
            const cities = blocks.map((block) => block.body);
            const { data, loading } = useMyFetch(options.endpoint, cities);
            return useMemo(() => ({
                byKey:  index(data),                         // keyed by blockKey(block)
                status: loading ? 'loading' : 'ready',
            }), [data, loading]);
        },
        renderBlock: ({ data, status }) => …,
    };
}
```

**A toolbar dialog:**

```tsx
dialogActionPlugin({
    id: 'emoji', label: '🙂 Emoji', title: 'Insert an emoji',
    dialog: ({ insert, close }) => <EmojiPicker onPick={(emoji) => insert(emoji)} onClose={close}/>,
});
```

**A typing trigger** — `:::` opening a palette is just an action plus a pattern:

```ts
blockPickerPlugin({ blocks: MY_PALETTE, trigger: /^:::$/ });
```

`blocks` is a value, so it can come from the server. Innoventa fetches the set its workspace can
actually resolve and rebuilds the plugin list when it arrives, which keeps the palette from offering
blocks that would only ever render a miss. Note that this narrows **writing**, not reading — the
parser must keep recognising every construct a document might already contain, so the renderer's
directive list stays static on purpose.

The matched text becomes a range, so what the dialog inserts *replaces* the prefix rather than
stacking a second one after it.

---

## Two rules

1. **The plugin list must be stable across renders.** Build it at module scope or memoise it. The
   library mounts one provider per data-bearing plugin, so a list that changes shape between renders
   changes hook order.
2. **The `context` object must be stable too**, for the same reason — see above.

Both are the ordinary React contract for anything hook-shaped; they are called out because breaking
them fails at runtime rather than at compile time.

---

## What's in the box

| | |
|---|---|
| **Engine** | `MarkdownRenderer`, `MarkdownEditor`, `CodeSurface`, `parseMarkdown`, `buildRegistry` |
| **Prose** | `gfmPlugin`, `mathPlugin`, `externalLinkPlugin`, `imagePlugin`, `codeHighlightPlugin` |
| **Blocks** | `calloutPlugin`, `youtubePlugin`, `mermaidPlugin`, `wavedromPlugin`, `dataBlockPlugin`, `jmePlugin` |
| **Authoring** | `blockPickerPlugin`, `snippetPickerPlugin`, `linkPlugin`, `imageInsertPlugin`, `tablePlugin`, `dialogActionPlugin` |
| **Host bindings** | `MarkdownUiProvider`, `httpResource`, `ResourcePicker` |

## Block syntax

| Shape | Example | Claimed by |
|---|---|---|
| `:::name argument` | `:::note Check the footprint.` | any plugin claiming `{ shape: 'line' }` |
| `;;;name` … `;;;` | a `;;;mermaid` diagram | any plugin claiming `{ shape: 'fence' }` |

Both are ignored inside fenced code, so documentation can *show* the syntax without it being
evaluated. Anything unclaimed is prose.

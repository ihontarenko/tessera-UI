/**
 * A plugin-driven Markdown renderer and editor.
 *
 * <p>The engine knows CommonMark, two block shapes (`:::name argument` and `;;;name … ;;;`) and
 * nothing else. Diagrams, maths, live data, applets, syntax highlighting and every toolbar button
 * arrive as plugins the host constructs and passes in — each with its own configuration, so an
 * endpoint, a picker or a renderer is something you *give* the library rather than something it knows.
 *
 * <p>Nothing under this directory imports an application module. See `README.md` for the wiring.
 */

// ── The engine ───────────────────────────────────────────────────────────────────
export * from './core';

// ── Host bindings ────────────────────────────────────────────────────────────────
export { MarkdownUiProvider, useMarkdownUi } from './ui/kit';
export type {
    ButtonProperties, FieldProperties, InputProperties, MarkdownUiKit, ModalProperties,
    SelectOption, SelectProperties, TabsProperties, TextareaProperties,
}                                            from './ui/kit';

export { Dialog, DialogGroup }                                                       from './ui/Dialog';
export { httpResource, matchesQuery }                                                from './ui/resource';
export type { HttpResourceOptions, ResourceItem, ResourceSource, ResourceTransport } from './ui/resource';
export { ResourcePicker }                                                            from './ui/ResourcePicker';

// ── Prose plugins ────────────────────────────────────────────────────────────────
export {
    codeHighlightPlugin, externalLinkPlugin, gfmPlugin, imagePlugin, mathPlugin, parseImageSize,
}                                                                             from './plugins/prose';
export type { CodeHighlightOptions, ImagePluginOptions as ImageProseOptions } from './plugins/prose';
export { CodeBlock }                                                          from './plugins/CodeBlock';
export type { Highlighter }                                                   from './plugins/CodeBlock';

// ── Block plugins ────────────────────────────────────────────────────────────────
export { calloutPlugin, youtubePlugin, DEFAULT_CALLOUT_KINDS } from './plugins/callouts';
export type { CalloutKind }                                    from './plugins/callouts';
export { BlockNotice }                                         from './plugins/BlockNotice';
export { mermaidPlugin }                                       from './plugins/diagrams';
export { dataBlockPlugin, promiseLoader }                      from './plugins/dataBlocks';
export type {
    DataBlockLoad, DataBlockLoader, DataBlockPluginOptions, DataBlockRenderProperties, DataBlockRequest,
    DataBlockResult,
}                                                              from './plugins/dataBlocks';

// ── The applet plugin ────────────────────────────────────────────────────────────
//
// ⚠️ Not here. `plugins/jme/` is the second of the two things this copy drops (see `README.md`): the
// expression language is Innoventa's form engine, and an evaluator with nothing to evaluate is a
// foreign domain's code shipped to a tracker. A `:::jme` block pasted here is unclaimed and stays
// prose, which is the intended outcome rather than a gap.

// ── Authoring plugins ────────────────────────────────────────────────────────────
export { blockPickerPlugin, snippetPickerPlugin }                         from './plugins/pickers';
export type {
    BlockDescriptor, BlockPickerOptions, SnippetPickerOptions, SnippetTemplate,
}                                                                         from './plugins/pickers';
export { dialogActionPlugin, imageInsertPlugin, linkPlugin, tablePlugin } from './plugins/inserts';
export type { ImagePluginOptions, LinkPluginOptions }                     from './plugins/inserts';

import type { MarkdownPlugin } from '../core';
import { MermaidDiagram }  from './diagrams/MermaidDiagram';

/**
 * The `;;;name … ;;;` diagram renderers. One plugin each, because they are separate libraries with
 * separate weights — a product that wants flowcharts and not waveforms installs one and pays for one.
 * Both load their renderer dynamically, so a document without diagrams costs nothing.
 *
 * ⚠️ **`wavedromPlugin` is not here, and this is one of the two places this copy differs from
 * Innoventa's** (see `README.md`'s note on the copy). Timing diagrams and register maps are that
 * product's electronics domain, and the renderer dynamically imports `wavedrom` and `json5` — packages
 * Tessera does not install, which Vite resolves at build time rather than at first use. Keeping the
 * file would have meant installing two dependencies to render a construct nobody here writes.
 *
 * A `;;;wavedrom` fence pasted into a Tessera document is therefore unclaimed, and unclaimed syntax
 * stays prose — which is the whole reason a document survives crossing between the two products.
 */

/** `;;;mermaid` — flowcharts, sequence and state diagrams. */
export function mermaidPlugin(): MarkdownPlugin<unknown> {
    return {
        name:        'mermaid',
        claims:      [{ shape: 'fence', name: 'mermaid' }],
        renderBlock: ({ block }) => <MermaidDiagram source={block.body}/>,
    };
}


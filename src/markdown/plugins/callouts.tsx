import type { MarkdownPlugin } from '../core';
import { BlockNotice } from './BlockNotice';
import s from './blocks.module.css';

/**
 * `:::note`, `:::tip`, `:::warning`, `:::info` — admonition boxes, and the simplest possible plugin:
 * one claim, one component, no data, no configuration beyond which kinds exist.
 */

export interface CalloutKind {
    readonly name:  string;
    readonly icon:  string;
    readonly style: 'note' | 'info' | 'tip' | 'warning';
}

export const DEFAULT_CALLOUT_KINDS: readonly CalloutKind[] = [
    { name: 'note',    icon: 'ℹ',  style: 'note' },
    { name: 'info',    icon: 'ℹ',  style: 'info' },
    { name: 'tip',     icon: '💡', style: 'tip' },
    { name: 'warning', icon: '⚠',  style: 'warning' },
];

const STYLE_CLASS: Record<CalloutKind['style'], string> = {
    note:    s.calloutNote,
    info:    s.calloutInfo,
    tip:     s.calloutTip,
    warning: s.calloutWarning,
};

export function calloutPlugin(options: { kinds?: readonly CalloutKind[] } = {}): MarkdownPlugin<unknown> {
    const kinds = options.kinds ?? DEFAULT_CALLOUT_KINDS;
    const byName = new Map(kinds.map((kind) => [kind.name, kind]));

    return {
        name:   'callouts',
        claims: kinds.map((kind) => ({ shape: 'line' as const, name: kind.name })),
        renderBlock: ({ block }) => {
            const kind = byName.get(block.name) ?? kinds[0];
            return (
                <div className={`${s.callout} ${STYLE_CLASS[kind.style]}`}>
                    <span className={s.calloutIcon} aria-hidden="true">{kind.icon}</span>
                    <span className={s.calloutText}>{block.body}</span>
                </div>
            );
        },
    };
}

/** `:::youtube <link> [WxH|%]` — a privacy-preserving embed with an optional size hint. */
export function youtubePlugin(): MarkdownPlugin<unknown> {
    return {
        name:   'youtube',
        claims: [{ shape: 'line', name: 'youtube' }],
        renderBlock: ({ block }) => {
            const [link, sizeHint] = block.body.trim().split(/\s+/);
            const videoId = extractYoutubeId(link ?? '');

            if (!videoId) {
                return (
                    <BlockNotice badge="bad link" directive={`:::youtube ${block.body}`}>
                        not a recognisable YouTube link.
                    </BlockNotice>
                );
            }

            const size  = parseFrameSize(sizeHint);
            const frame = (
                <iframe
                    src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                    title="YouTube video"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            );

            return size
                ? <div className={s.videoFixed} style={size}>{frame}</div>
                : <div className={s.video}>{frame}</div>;
        },
    };
}

/** Any of the common YouTube URL shapes, or a bare id. */
function extractYoutubeId(url: string): string | null {
    const match = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(url);
    if (match) {
        return match[1];
    }
    return /^[A-Za-z0-9_-]{6,}$/.test(url) ? url : null;
}

/** A `320x240` or `50%` hint as a CSS size, or null for the default responsive 16:9 box. */
function parseFrameSize(token?: string): { width: string; height?: string } | null {
    const hint       = token?.trim() ?? '';
    const dimensions = /^(\d+)x(\d+)$/.exec(hint);
    if (dimensions) {
        return { width: `${dimensions[1]}px`, height: `${dimensions[2]}px` };
    }
    const percent = /^(\d+)%$/.exec(hint);
    if (percent) {
        return { width: `${percent[1]}%` };
    }
    return null;
}

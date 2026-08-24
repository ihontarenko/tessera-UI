import { themedFaviconPainter, type MarkColours } from "@jmouse/ui"

/**
 * Tessera's tab mark, redrawn in whichever of the 29 themes is on.
 *
 * <p>⚠️ **Only the drawing is here.** Reading the colours actually in force, encoding the markup and
 * hanging it on the one `rel="icon"` link is `@jmouse/ui`'s `themedFaviconPainter` — identical in every
 * product.
 *
 * <p>Until this existed, `public/favicon.svg` was the whole story and its own comment said why that was
 * a compromise: *"a file requested before any script runs cannot know which of the 27 themes the reader
 * picked, so the brand keeps one face in the tab regardless"*. That file still paints the first frame,
 * the bookmark and the link preview; this takes over the moment a theme is known.
 *
 * <h2>⚠️ The geometry is `public/favicon.svg`'s, and the two must not drift</h2>
 *
 * <p>A rounded tile with an inset diamond — "one ticket, one tile", a tessera being the token Rome used
 * as a ticket. The proportions are opened up for 16px exactly as that file describes: the inner tile
 * fills 73% of the plate and the diamond 37%, which keeps roughly `TesseraMark`'s ratio while opening
 * the gap between the strokes. If the mark changes, both change, and the static file goes first.
 */

/** The corner radius as a fraction of the plate — 0.28 of the side, matching the sidebar's tile. */
const PLATE_RADIUS = 6.7

function drawMark({ plate, ink }: MarkColours): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">` +
    `<rect width="24" height="24" rx="${PLATE_RADIUS}" fill="${plate}"/>` +
    `<g fill="none" stroke="${ink}" stroke-width="1.7" stroke-linejoin="round">` +
    `<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4"/>` +
    `<rect x="8.9" y="8.9" width="6.2" height="6.2" rx="1.4" transform="rotate(45 12 12)"/>` +
    `</g></svg>`
  )
}

/** Hand this to `ThemeProvider`'s `onThemeApplied`. */
export const repaintMark = themedFaviconPainter(drawMark)

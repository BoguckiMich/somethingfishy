/** The one UI font family (VT323, OFL, bundled in public/fonts; see index.html), used by Phaser text and DOM css. */
export const FONT_NAME = 'VT323';
export const FONT = `'${FONT_NAME}', monospace`;

/** Loads the font (with Polish glyphs) so canvas text measures correctly; never rejects, never waits long. */
export async function loadFonts(timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const load = document.fonts.load(`400 10px '${FONT_NAME}'`, 'Aa Ąćęłńóśźż').then(
    () => undefined,
    () => undefined,
  );
  await Promise.race([load, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

/**
 * Text sizes (px) on VT323's pixel grid. Measured (glyph bounds on a canvas at 100 px): its design pixel is
 * 0.08 em = 12.5 px of font size per 1 px of stroke; capitals are 7 px tall, x-height 5 px, advance 5 px.
 * So 12.5 -> 1 px strokes, 25 -> 2 px, 37.5 -> 3 px, 50 -> 4 px, and at render scale K the strokes stay whole
 * device pixels. Tiny is only for the dev tag; 25 is the floor for real text (it is about as wide as Tiny5 at
 * 15 px was, but taller). VT323 has a single weight: never ask for bold (index.html sets font-synthesis: none).
 */
export const FS = { tiny: 12.5, small: 25, body: 25, heading: 37.5, title: 50 } as const;

/**
 * Line height (unitless) for all text. VT323's own `normal` line height is ~1.33 em, far too airy, so everything
 * pins this value (index.html sets it on body; `font:` shorthands in code pass it as `size/LINE`). The font has
 * ascent 0.8 em / descent 0.2 em and capitals 0.56 em tall, so its capitals sit within 0.02 em of the middle of
 * the line box: single-line DOM labels and buttons centre correctly with plain symmetric padding. Canvas (Phaser)
 * text boxes are taller above the capitals than below (room for accents), so there use `textPad` below.
 */
export const LINE = 1.2;

/**
 * Padding for Phaser Text objects that sit in a frame or button. Phaser sizes the text box from the glyph bounds
 * (accent room above, descender room below), which leaves VT323's capitals ~2 px (at 25 px) low in a symmetric
 * box; this shifts the padding by that amount so the frame is optically centred on the capitals.
 */
export function textPad(x: number, y: number, size: number = FS.body): { left: number; right: number; top: number; bottom: number } {
  const nudge = Math.round(size * 0.08);
  return { left: x, right: x, top: Math.max(0, y - nudge), bottom: y + nudge };
}

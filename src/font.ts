/** The one UI font family (Tiny5, OFL, bundled in public/fonts; see index.html), used by Phaser text and DOM css. */
export const FONT_NAME = 'Tiny5';
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
 * Text sizes (px) on Tiny5's pixel grid: its design pixel is 1/10 em, so 10 -> 1 px strokes,
 * 20 -> 2 px, 30 -> 3 px; 15 is off-grid but reads clean on phones and is the floor for real text (tiny
 * is only for dev tags and log-tile hints). Tiny5 has a single weight: never ask for bold (the browser would fake it
 * and smear the pixels; index.html sets font-synthesis: none). Use colour and size for emphasis.
 */
export const FS = { tiny: 10, small: 15, body: 15, heading: 20, title: 30 } as const;

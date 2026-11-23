/** The one UI font family (Pixelify Sans, bundled in public/fonts; see index.html), used by Phaser text and DOM css. */
export const FONT_NAME = 'Pixelify Sans';
export const FONT = `'${FONT_NAME}', monospace`;

/** Loads the regular and bold faces so canvas text measures correctly; never rejects, never waits long. */
export async function loadFonts(timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const load = Promise.all([
    document.fonts.load(`400 16px '${FONT_NAME}'`, 'Aa Ąćęłńóśźż'),
    document.fonts.load(`700 16px '${FONT_NAME}'`, 'Aa Ąćęłńóśźż'),
  ]).then(() => undefined, () => undefined);
  await Promise.race([load, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

/**
 * The text sizes (px) that sit on Pixelify Sans's pixel grid: its design pixel is 1/11 em, so only
 * sizes near a multiple of 11 keep every stroke a whole number of pixels (11 -> 1 px, 22 -> 2 px,
 * 33 -> 3 px); 12 is the one off-grid size kept for body text (a 9% stretch, still clean).
 */
export const FS = { small: 11, body: 12, heading: 22, title: 33 } as const;

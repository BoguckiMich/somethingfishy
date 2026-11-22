/** Pure sprite grid parsing: no Phaser, no DOM. */

export interface Sprite {
  width: number;
  height: number;
  /** Row-major; 0xRRGGBB, or -1 for transparent. */
  pixels: Int32Array;
}

export const TRANSPARENT = -1;

/**
 * Parses a palette-indexed string grid. `.` is transparent; every other character must be a key
 * of `colors`. Throws on ragged rows, empty grids and unknown characters.
 */
export function sprite(grid: string, colors: Record<string, number>): Sprite {
  const rows = grid
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  if (rows.length === 0) throw new Error('sprite: empty grid');
  const width = rows[0].length;
  const pixels = new Int32Array(width * rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`sprite: ragged row ${y} (expected ${width} columns, got ${row.length}): "${row}"`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      if (ch === '.') {
        pixels[y * width + x] = TRANSPARENT;
      } else if (Object.prototype.hasOwnProperty.call(colors, ch)) {
        pixels[y * width + x] = colors[ch];
      } else {
        throw new Error(`sprite: unknown character "${ch}" at row ${y}, column ${x}`);
      }
    }
  });
  return { width, height: rows.length, pixels };
}

/** Grid → RGBA bytes (transparent pixels are 0,0,0,0). */
export function spriteToRgba(s: Sprite): Uint8ClampedArray {
  const out = new Uint8ClampedArray(s.width * s.height * 4);
  for (let i = 0; i < s.pixels.length; i++) {
    const c = s.pixels[i];
    if (c === TRANSPARENT) continue;
    out[i * 4] = (c >> 16) & 255;
    out[i * 4 + 1] = (c >> 8) & 255;
    out[i * 4 + 2] = c & 255;
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function flipSpriteX(s: Sprite): Sprite {
  const pixels = new Int32Array(s.pixels.length);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) pixels[y * s.width + x] = s.pixels[y * s.width + (s.width - 1 - x)];
  }
  return { width: s.width, height: s.height, pixels };
}

/** Copy of `s` with rows [fromRow, toRow] moved down one pixel (breathing frames). */
export function shiftRowsDown(s: Sprite, fromRow: number, toRow: number): Sprite {
  const pixels = Int32Array.from(s.pixels);
  for (let y = toRow; y > fromRow; y--) {
    for (let x = 0; x < s.width; x++) pixels[y * s.width + x] = s.pixels[(y - 1) * s.width + x];
  }
  for (let x = 0; x < s.width; x++) pixels[fromRow * s.width + x] = TRANSPARENT;
  return { width: s.width, height: s.height, pixels };
}

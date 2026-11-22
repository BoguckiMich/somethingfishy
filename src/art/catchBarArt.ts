import { PAL } from './palette';
import { TRANSPARENT, type Sprite } from './pixelGrid';

/** Pure art for the catch bar: a pixel-art wooden frame around a transparent window. */

export const BAR_BORDER = 4;
/** The window the fish and the zone move in (inner size, in pixels). */
export const BAR_INNER = { w: 22, h: 340 };
/** The slim progress strip next to the bar. */
export const STRIP_INNER = { w: 6, h: 340 };

/**
 * A wooden frame `border` px thick around an empty (transparent) window of `innerW` x `innerH`:
 * dark rim, light top edge, mid wood, dark inner shade, and a nail in every corner.
 */
export function barFrameSprite(innerW: number, innerH: number, border = BAR_BORDER): Sprite {
  const width = innerW + border * 2;
  const height = innerH + border * 2;
  const pixels = new Int32Array(width * height).fill(TRANSPARENT);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Distance from the outer edge: 0 = rim, then light, mid, inner shade.
      const ring = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (ring >= border) continue;
      let c: number = PAL.wood;
      if (ring === 0) c = PAL.outline;
      else if (ring === 1) c = x === width - 2 || y === height - 2 ? PAL.woodDark : PAL.woodHi;
      else if (ring === border - 1) c = PAL.woodDeep;
      else c = (x + y) % 7 === 0 ? PAL.woodDark : PAL.woodLight;
      pixels[y * width + x] = c;
    }
  }
  for (const [x, y] of [[1, 1], [width - 2, 1], [1, height - 2], [width - 2, height - 2]]) {
    pixels[y * width + x] = PAL.stoneLight;
  }
  return { width, height, pixels };
}

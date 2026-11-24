import { PAL } from './palette';
import { TRANSPARENT, sprite, type Sprite } from './pixelGrid';

/** Pure art for the catch bar: a pixel-art wooden frame around a transparent window. */

export const BAR_BORDER = 6;
/** The window the fish and the zone move in (inner size, in pixels). */
export const BAR_INNER = { w: 36, h: 340 };
/** The slim progress strip next to the bar. */
export const STRIP_INNER = { w: 6, h: 340 };

/**
 * A wooden frame `border` px thick around an empty (transparent) window of `innerW` x `innerH`:
 * dark rim, a light bevel on the top/left (shaded on the bottom/right), light wood with a faint
 * grain, a darker inner step, a deep inner shade against the window, and a nail in every corner.
 */
export function barFrameSprite(innerW: number, innerH: number, border = BAR_BORDER): Sprite {
  const width = innerW + border * 2;
  const height = innerH + border * 2;
  const pixels = new Int32Array(width * height).fill(TRANSPARENT);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Distance from the outer edge: 0 = rim, then bevel, wood, inner step, inner shade.
      const ring = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (ring >= border) continue;
      const lit = Math.min(x, y) < Math.min(width - 1 - x, height - 1 - y);
      let c: number = PAL.woodLight;
      if (ring === 0) c = PAL.outline;
      else if (ring === 1) c = lit ? PAL.sandLight : PAL.wood;
      else if (ring === border - 1) c = PAL.woodDeep;
      else if (border >= 5 && ring === border - 2) c = lit ? PAL.wood : PAL.woodDark;
      else c = (x + y) % 7 === 0 ? PAL.wood : PAL.woodLight;
      pixels[y * width + x] = c;
    }
  }
  const nail = border >= 5 ? 2 : 1;
  for (const [x, y] of [[nail, nail], [width - 1 - nail, nail], [nail, height - 1 - nail], [width - 1 - nail, height - 1 - nail]]) {
    pixels[y * width + x] = PAL.stoneLight;
  }
  return { width, height, pixels };
}

/** 9 x 9 icons for the ends of the progress strip (slice 22c): a fish at the top (what you are after) and a net at the bottom. */
export const STRIP_ICON_SIZE = 9;

const FISH_ICON = `
.........
.........
..ooooo.o
.oggggooo
oggeggggo
.oggggooo
..ooooo.o
.........
.........
`;

const NET_ICON = `
..ooooo..
.ocmcmco.
.omcmcmo.
.ocmcmco.
..omcmo..
...ooo...
....w....
....w....
....w....
`;

export const stripFishSprite = (): Sprite => sprite(FISH_ICON, { o: PAL.outline, g: PAL.gold, e: PAL.outline });
export const stripNetSprite = (): Sprite => sprite(NET_ICON, { o: PAL.outline, c: PAL.cream, m: PAL.stoneLight, w: PAL.woodLight });

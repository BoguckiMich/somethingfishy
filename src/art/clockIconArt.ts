import type { TimeOfDay } from '../core/clock';
import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';

/**
 * Pure art for the 9 x 9 time and depth icons (slice 22b): a sun, a half sun on the horizon (dawn and dusk),
 * a crescent moon, and one or three waves (shallow / deep). The fish log shows them on locked tiles; the lake
 * clock (slice 22c) reuses the sun, half sun and moon. No outline: they sit on dark wood or a dark frame.
 */
export const CLOCK_ICON_SIZE = 9;

const SUN = `
....e....
.e..e..e.
..eeeee..
..essse..
e.essse.e
..essse..
..eeeee..
.e..e..e.
....e....
`;

const HALF_SUN = `
.........
....e....
.e..e..e.
..eeeee..
..essse..
.eesssee.
hhhhhhhhh
.hhhhhhh.
.........
`;

const MOON = `
...ddmm..
..dmmm...
.dmmm....
.dmm.....
.dmm.....
.dmmm....
..dmmmm..
...dmmmmm
....ddddd
`;

const WAVE = ['.ww...ww.', 'w..www..w'] as const;

export const sunSprite = (): Sprite => sprite(SUN, { e: PAL.sunEdge, s: PAL.sun });
export const halfSunSprite = (): Sprite => sprite(HALF_SUN, { e: PAL.sunEdge, s: PAL.sun, h: PAL.stoneLight });
export const moonSprite = (): Sprite => sprite(MOON, { m: PAL.moon, d: PAL.moonShade });

/** One wave (shallow) or three stacked waves (deep). Both are light blues so they read on dark wood. */
export function wavesSprite(count: 1 | 3): Sprite {
  const blank = '.........';
  const rows =
    count === 1
      ? [blank, blank, blank, blank, WAVE[0], WAVE[1], blank, blank, blank]
      : [WAVE[0], WAVE[1], blank, WAVE[0], WAVE[1], blank, WAVE[0], WAVE[1], blank];
  return sprite(rows.join('\n'), { w: count === 1 ? PAL.shallow3 : PAL.shallow1 });
}

/** The icon for a time of day: sun (day), half sun (dawn, dusk), moon (night). */
export function timeIconSprite(t: TimeOfDay): Sprite {
  return t === 'day' ? sunSprite() : t === 'night' ? moonSprite() : halfSunSprite();
}

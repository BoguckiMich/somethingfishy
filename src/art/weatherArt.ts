import type { WeatherId } from '../core/data/weather';
import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';

/**
 * Pure art for the 9 x 9 weather icons (slice 23b): a sun, a grey cloud, a cloud with rain, wind swirls and
 * fog bands. They sit next to the clock on its dark plate and on the fish-log card, so no outline.
 * Contact sheet: /dev/icon-sheet.html.
 */
export const WEATHER_ICON_SIZE = 9;

const SUNNY = `
....e....
.e..e..e.
..eeeee..
..essse..
eeessseee
..essse..
..eeeee..
.e..e..e.
....e....
`;

const OVERCAST = `
.........
.........
...ccc...
..cccccc.
.ccccccc.
cccccccdd
cccccccdd
.dddddd..
.........
`;

const RAIN = `
.........
...ccc...
..cccccc.
.ccccccc.
ccccccddd
.dddddd..
.r..r..r.
..r..r...
.r..r..r.
`;

const WINDY = `
.........
.www.....
...ww.w..
www..www.
.....w.w.
.wwwww.w.
.....www.
.ww.w....
...ww....
`;

const FOG = `
.........
.fffffff.
.........
..fffff..
.........
fffffffff
.........
...fffff.
.........
`;

const GRIDS: Record<WeatherId, { grid: string; colors: Record<string, number> }> = {
  sunny: { grid: SUNNY, colors: { e: PAL.sunEdge, s: PAL.sun } },
  overcast: { grid: OVERCAST, colors: { c: PAL.cloud, d: PAL.cloudDark } },
  rain: { grid: RAIN, colors: { c: PAL.cloudShade, d: PAL.cloudDark, r: PAL.shallow3 } },
  windy: { grid: WINDY, colors: { w: PAL.foam } },
  fog: { grid: FOG, colors: { f: PAL.stoneLight } },
};

export function weatherSprite(id: WeatherId): Sprite {
  const g = GRIDS[id];
  return sprite(g.grid, g.colors);
}

// ---- The look of the lake in each weather (pure helpers; the scene draws with them) ----

/** Moves a colour toward its own grey by `amount` (0 = unchanged). */
export function greyTowards(color: number, amount: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const y = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  // Grey, and a little darker: a clouded day is not as bright.
  const mix = (c: number) => Math.round((c + (y - c) * amount) * (1 - 0.2 * amount)) & 255;
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/** A grey-tinted copy of a day look: overcast and rain dull the sky, the water and the clouds; sunny leaves it alone. */
export function weatherLook<T extends { skyTop: number; skyBottom: number; waterTint: number; worldTint: number; cloudTint: number }>(look: T, grey: number): T {
  if (grey <= 0) return look;
  return {
    ...look,
    skyTop: greyTowards(look.skyTop, grey),
    skyBottom: greyTowards(look.skyBottom, grey),
    waterTint: greyTowards(look.waterTint, grey),
    cloudTint: greyTowards(look.cloudTint, grey * 0.7),
    worldTint: greyTowards(look.worldTint, grey * 0.4),
  };
}

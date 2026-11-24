import { MAP_SIZE } from '../core/data/locations';
import { Pix } from './characters';
import { PAL } from './palette';
import { TRANSPARENT, sprite, type Sprite } from './pixelGrid';

/**
 * Pure art for the road map (slice 18): the map picture (MAP_SIZE, a sea strip at the top, a river, grey quarry
 * cliffs, the little lake bottom-left, a winding dirt road joining the four places), a pin (open = red, locked = grey),
 * a gold ring for the selected pin, a tiny white car for "you are here" and a red-white work-in-progress road barrier.
 * Everything is code- or grid-drawn from the one palette; no Phaser, no DOM.
 */

type Pt = readonly [number, number];

/** Deterministic 0..99 noise per pixel (no RNG state, so the picture is always the same). */
function noise(x: number, y: number): number {
  let h = (Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return h % 100;
}

/** Walks a polyline in ~1 px steps, with an optional sideways wiggle, calling `at` for each step. */
function walk(pts: readonly Pt[], wiggle: number, at: (x: number, y: number) => void): void {
  let travelled = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = len ? -(y1 - y0) / len : 0;
    const ny = len ? (x1 - x0) / len : 0;
    for (let s = 0; s <= len; s += 0.5) {
      const w = Math.sin((travelled + s) / 5) * wiggle;
      at(x0 + ((x1 - x0) * s) / len + nx * w, y0 + ((y1 - y0) * s) / len + ny * w);
    }
    travelled += len;
  }
}

const RIVER: readonly Pt[] = [[80, 11], [84, 26], [92, 42], [102, 58], [110, 70], [124, 82], [150, 87]];
const ROAD_MAIN: readonly Pt[] = [[34, 90], [42, 79], [58, 72], [78, 72], [98, 64], [108, 50], [114, 38], [120, 26]];
const ROAD_QUARRY: readonly Pt[] = [[42, 79], [34, 68], [30, 58], [30, 50]];
const TREES: readonly Pt[] = [[62, 28], [50, 22], [68, 50], [14, 74], [66, 92], [128, 62], [138, 46], [82, 90], [132, 100], [12, 26], [58, 36]];

function pine(p: Pix, x: number, y: number): void {
  p.rect(x, y - 1, 1, 2, PAL.woodDark);
  for (let r = 0; r < 5; r++) {
    const half = r < 2 ? r : r - 1;
    for (let dx = -half; dx <= half; dx++) p.set(x + dx, y - 2 - (4 - r), r % 2 ? PAL.pine : PAL.pineLight);
  }
  p.set(x, y - 7, PAL.pineLight);
}

/** The map picture, MAP_SIZE pixels. */
export function mapSprite(): Sprite {
  const { w, h } = MAP_SIZE;
  const p = new Pix(w, h);

  // Grass.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = noise(x, y);
      p.set(x, y, n < 8 ? PAL.grass0 : n > 94 ? PAL.grass2 : PAL.grass1);
    }
  }

  // Sea strip with a sandy, wavy shore.
  const shore = (x: number) => 11 + Math.round(Math.sin(x / 7) * 1.5);
  for (let x = 0; x < w; x++) {
    const s = shore(x);
    for (let y = 0; y < s; y++) p.set(x, y, y < 4 ? PAL.shallow0 : y < 8 ? PAL.shallow1 : PAL.shallow2);
    p.set(x, s, PAL.foam);
    p.set(x, s + 1, PAL.sandLight);
    p.set(x, s + 2, PAL.sand);
    if (noise(x, 3) < 12) p.set(x, 3 + (x % 3), PAL.shallow3);
    if (noise(x, 5) < 10) p.set(x, s + 3, PAL.sandDark);
  }

  // Quarry: grey cliffs in layers around a deep, clear pool.
  const cliff = (x: number, y: number) => {
    const dx = (x - 28) / 22;
    const dy = (y - 46) / 15;
    return dx * dx + dy * dy <= 1 + (noise(x, y) < 20 ? 0.12 : 0) * (noise(y, x) < 50 ? 1 : -1);
  };
  for (let y = 30; y <= 62; y++) {
    for (let x = 4; x <= 52; x++) {
      if (!cliff(x, y)) continue;
      const band = (y + (x >> 3)) % 5;
      p.set(x, y, y < 38 ? PAL.stoneLight : band === 0 ? PAL.stoneDark : band < 3 ? PAL.stone : PAL.stoneLight);
    }
  }
  p.ell(29, 49, 11, 4.5, PAL.stoneDark);
  p.ell(29, 49.5, 10, 3.6, PAL.deep2);
  p.ell(29, 50, 7, 2.3, PAL.shallow1);
  p.set(33, 49, PAL.foam);
  p.set(34, 49, PAL.foam);

  // The lake, bottom-left: deeper in the middle.
  p.ell(30, 104, 25, 14, PAL.sandDark);
  p.ell(30, 104, 24, 13, PAL.shallow1);
  p.ell(30, 105, 16, 8, PAL.shallow0);
  p.ell(30, 106, 8, 4, PAL.deep2);
  for (const [x, y] of [[17, 98], [44, 99], [26, 94], [38, 96]] as Pt[]) p.rect(x, y, 3, 1, PAL.shallow3);
  p.rect(48, 96, 2, 3, PAL.reed); // a couple of reeds
  p.rect(50, 95, 1, 3, PAL.reedLight);

  // The river: bank, then water.
  walk(RIVER, 1.4, (x, y) => p.ell(x, y, 3.3, 3.3, PAL.sandDark));
  walk(RIVER, 1.4, (x, y) => p.ell(x, y, 2.4, 2.4, PAL.shallow1));
  walk(RIVER, 1.4, (x, y) => p.set(x + 1, y, PAL.shallow2));

  // The dirt road: a darker edge, then the track, with a pale line down the middle.
  for (const road of [ROAD_MAIN, ROAD_QUARRY]) walk(road, 0.8, (x, y) => p.ell(x, y, 2.3, 2.3, PAL.sandDark));
  for (const road of [ROAD_MAIN, ROAD_QUARRY]) walk(road, 0.8, (x, y) => p.ell(x, y, 1.4, 1.4, PAL.sand));
  let k = 0;
  walk(ROAD_MAIN, 0.8, (x, y) => {
    if (k++ % 6 === 0) p.set(x, y, PAL.sandLight);
  });

  // A little plank bridge where the road crosses the river.
  p.rect(100, 54, 9, 6, PAL.woodLight);
  p.rect(100, 54, 9, 1, PAL.woodHi);
  p.rect(100, 59, 9, 1, PAL.woodDark);
  for (let x = 102; x <= 108; x += 2) p.rect(x, 55, 1, 4, PAL.wood);

  // The sea pier: planks running out into the water from the beach.
  p.rect(118, 6, 5, 13, PAL.woodLight);
  p.rect(118, 6, 1, 13, PAL.woodDark);
  p.rect(122, 6, 1, 13, PAL.woodDark);
  for (let y = 7; y < 19; y += 2) p.rect(119, y, 3, 1, PAL.woodHi);
  p.rect(117, 5, 7, 1, PAL.woodDark);

  // Pines.
  for (const [x, y] of TREES) pine(p, x, y);

  // A thin dark frame so the map reads as a picture.
  for (let x = 0; x < w; x++) {
    p.set(x, 0, PAL.outline);
    p.set(x, h - 1, PAL.outline);
  }
  for (let y = 0; y < h; y++) {
    p.set(0, y, PAL.outline);
    p.set(w - 1, y, PAL.outline);
  }
  return p.done();
}

export const PIN_SIZE = { w: 9, h: 11 };

/** A map pin, 9 x 11, its tip on the bottom middle pixel. Open places are red, locked ones grey. */
export function pinSprite(open: boolean): Sprite {
  return sprite(
    `
    ..kkkkk..
    .kRRRRRk.
    kRHHRRRRk
    kRHWRRRrk
    kRRRRRRrk
    kRRRRRrrk
    .kRRRrrk.
    .kRRRrrk.
    ..kRRrk..
    ...krk...
    ....k....
    `,
    open
      ? { k: PAL.outline, R: PAL.red, r: PAL.redDark, H: PAL.redLight, W: PAL.white }
      : { k: PAL.outline, R: PAL.stone, r: PAL.stoneDark, H: PAL.stoneLight, W: PAL.whiteShade },
  );
}

export const RING_SIZE = { w: 17, h: 7 };

/** A flat gold ring that sits under the selected pin (centred on the pin's tip). */
export function selectRingSprite(): Sprite {
  const p = new Pix(RING_SIZE.w, RING_SIZE.h);
  p.ell(8, 3, 7, 2.4, PAL.gold);
  p.ell(8, 3, 5.4, 1.2, TRANSPARENT);
  p.outline();
  return p.done();
}

export const HERE_SIZE = { w: 13, h: 8 };

/** The "you are here" marker: a tiny white car, side view, facing right. */
export function hereCarSprite(): Sprite {
  const p = new Pix(HERE_SIZE.w, HERE_SIZE.h);
  p.rect(3, 1, 6, 1, PAL.white); // roof
  p.rect(3, 2, 6, 1, PAL.denimLight); // windows
  p.rect(1, 3, 11, 3, PAL.white); // body
  p.rect(1, 5, 11, 1, PAL.whiteShade);
  p.set(11, 3, PAL.gold); // headlight
  p.set(6, 2, PAL.white); // window pillar
  p.outline();
  p.rect(3, 6, 2, 2, PAL.outline); // wheels
  p.rect(8, 6, 2, 2, PAL.outline);
  p.set(3, 6, PAL.stone);
  p.set(8, 6, PAL.stone);
  return p.done();
}

export const BARRIER_SIZE = { w: 14, h: 11 };

/** The work-in-progress sign: a red-white striped road barrier on two posts. */
export function barrierSprite(): Sprite {
  const p = new Pix(BARRIER_SIZE.w, BARRIER_SIZE.h);
  p.rect(2, 5, 2, 5, PAL.woodLight); // posts
  p.rect(10, 5, 2, 5, PAL.woodLight);
  p.rect(2, 5, 1, 5, PAL.woodHi);
  p.rect(10, 5, 1, 5, PAL.woodHi);
  for (let y = 1; y <= 4; y++) {
    for (let x = 1; x <= 12; x++) p.set(x, y, ((x + y) >> 1) % 2 ? PAL.red : PAL.white);
  }
  p.rect(1, 4, 12, 1, PAL.redDark); // underside of the board
  p.outline();
  return p.done();
}

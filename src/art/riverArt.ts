import { lerpColor } from './dayCycle';
import { distanceToY, FAR_SHORE_TOP, FAR_SHORE_Y, SHORE_Y, W, WATER_BOTTOM } from './layout';
import { PAL } from './palette';
import { bayer, mulberry32, Raster, rampDither } from './raster';
import { BUSH, BUSH_BIG, ROUND_A, ROUND_B, ROUND_C } from './sprites';
import { nearShoreRaster } from './scenery';
import { RIVER_BEND } from '../core/data/locations';

/**
 * PLACEHOLDER art of the River bend (slice 25a, pure): flat far bank, a river band with a bend, a gravel near bank and
 * W.'s hut as a plain rectangle. The real river art is slice 25b. Same sizes and positions as the lake's pictures.
 */

const FS_H = FAR_SHORE_Y + 4 - FAR_SHORE_TOP;
const BASE = FAR_SHORE_Y - FAR_SHORE_TOP;

/** A low far bank of willows and alders: shorter and closer than the lake's pine ridge. */
export function riverFarBankRaster(): Raster {
  const r = new Raster(W, FS_H);
  const rnd = mulberry32(4242);
  for (let x = 0; x < W; x++) {
    const h = 9 + 3 * Math.sin(x / 37) + 2 * Math.sin(x / 11 + 1);
    const crest = Math.round(BASE - h);
    for (let y = crest; y < BASE; y++) {
      const depth = y - crest;
      let c: number = depth === 0 ? lerpColor(PAL.hill, PAL.leafHi, 0.3) : PAL.hill;
      if (depth > 4 && bayer(x, y) < (depth - 4) / 8) c = PAL.hillDark;
      r.set(x, y, c);
    }
    r.set(x, BASE, PAL.leafDeep);
    r.set(x, BASE + 1, rnd() < 0.4 ? PAL.stone : PAL.stoneDark);
    r.set(x, BASE + 2, PAL.sandDark);
  }
  const trees = [ROUND_A, ROUND_B, ROUND_C, BUSH, BUSH_BIG];
  let x = -6;
  while (x < W + 4) {
    const sp = trees[Math.floor(rnd() * trees.length)];
    r.blit(sp, x, BASE + 1 - sp.height, { flip: rnd() < 0.5 });
    x += Math.max(8, Math.floor(sp.width * (0.6 + rnd() * 0.4)));
  }
  return r;
}

const WATER_RAMP = [PAL.deep0, PAL.deep1, PAL.deep2, PAL.shallow0, PAL.shallow1, PAL.shallow2, PAL.shallow3];

/** Ramp position for a world y: the pool (far, dark), the seam, the riffle (near, light), with dithered joins at the zone edges. */
function riverRampPos(y: number): number {
  const poolEdge = distanceToY(RIVER_BEND.zones[1].toM - 0); // 26 m
  const seamEdge = distanceToY(RIVER_BEND.zones[0].toM); // 12 m
  if (y < poolEdge - 10) return 0.4 + ((y - FAR_SHORE_Y) / (poolEdge - 10 - FAR_SHORE_Y)) * 1.2;
  if (y < poolEdge + 10) return 1.6 + ((y - (poolEdge - 10)) / 20) * 1.2;
  if (y < seamEdge) return 2.8 + ((y - (poolEdge + 10)) / Math.max(1, seamEdge - poolEdge - 10)) * 1.4;
  return 4.2 + Math.min(1, (y - seamEdge) / (SHORE_Y - seamEdge)) * 1.8;
}

/** The river band: the same water area as the lake, with a lighter gravel bar swinging round the inside of a bend and foam streaks. */
export function riverWaterRaster(): Raster {
  const h = WATER_BOTTOM - FAR_SHORE_Y;
  const r = new Raster(W, h);
  const rnd = mulberry32(77);
  for (let ly = 0; ly < h; ly++) {
    const wy = FAR_SHORE_Y + ly;
    const base = riverRampPos(wy);
    // The bend: a curve sweeping from the top right to the left edge; the water inside it (below) is shallower.
    for (let x = 0; x < W; x++) {
      const curve = FAR_SHORE_Y + 70 + 60 * Math.sin((x / W) * Math.PI * 0.9 + 0.4);
      const inside = wy > curve ? Math.min(1, (wy - curve) / 40) : 0;
      r.set(x, ly, rampDither(WATER_RAMP, base + inside * 0.9, x, ly));
    }
  }
  // Current: long foam streaks, a bit slanted along the bend, drawn left-ward.
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * W);
    const ly = Math.floor(rnd() * (h - 6));
    const len = 8 + Math.floor(rnd() * 16);
    const color = rnd() < 0.5 ? PAL.shallow3 : PAL.shallow2;
    for (let k = 0; k < len; k++) r.set(x + k, ly + Math.round(k * 0.08), color, 170);
  }
  return r;
}

/** The near bank as a gravel bar: the lake's sand turned grey stone, the grass left alone. */
export function riverNearBankRaster(): Raster {
  const r = nearShoreRaster();
  const swap = new Map<number, number>([
    [PAL.sand, PAL.stone],
    [PAL.sandLight, PAL.stoneLight],
    [PAL.sandDark, PAL.stoneDark],
  ]);
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      const to = swap.get(r.get(x, y));
      if (to !== undefined && r.alphaAt(x, y) === 255) r.set(x, y, to);
    }
  }
  return r;
}

export const HUT_SIZE = { w: 44, h: 34 };
/** W.'s hut for now: a plank box with a dark roof and a door. */
export function hutRaster(): Raster {
  const r = new Raster(HUT_SIZE.w, HUT_SIZE.h);
  r.rect(2, 12, 40, 22, PAL.wood);
  for (let y = 14; y < 34; y += 5) r.rect(2, y, 40, 1, PAL.woodDark);
  r.rect(2, 12, 40, 1, PAL.woodHi);
  r.rect(0, 6, 44, 7, PAL.stoneDark);
  r.rect(0, 6, 44, 1, PAL.stoneLight);
  r.rect(4, 2, 36, 5, PAL.stoneDark);
  r.rect(4, 2, 36, 1, PAL.stoneLight);
  r.rect(26, 18, 10, 16, PAL.woodDeep);
  r.rect(7, 18, 9, 8, PAL.woodDeep);
  r.rect(8, 19, 7, 6, PAL.sandLight);
  return r;
}

/** Where the hut stands (feet, bottom middle): on the near bank at the right, clear of the notice-board sign and the windsock. */
export const HUT_FEET = { x: 322, y: 452 };

import { lerpColor } from './dayCycle';
import { BOBBER_X, distanceToY, DOCK, FAR_SHORE_TOP, FAR_SHORE_Y, NEAR_SHORE_TOP, SHORE_Y, W, WATER_BOTTOM } from './layout';
import { PAL } from './palette';
import { bayer, mulberry32, Raster, rampDither } from './raster';
import { BUSH, TUFT_A, TUFT_B } from './sprites';
import { dockRaster, nearShoreRaster } from './scenery';
import {
  ALDER,
  ALDER_BIG,
  ALDER_LOW,
  BOULDER_SIZES,
  boulderSprite,
  FAR_POST,
  MOORING_POST,
  ROPE_POST,
  ROPE_POST_KNOT,
  WILLOW,
  WILLOW_BIG,
  WILLOW_NEAR,
  scaleSprite,
  type BoulderSize,
} from './riverSprites';
import { RIVER_BEND } from '../core/data/locations';
import type { Sprite } from './pixelGrid';

/**
 * The River bend's pictures (slice 25b, pure): a low far bank of willows and alders with the far ferry post, the bending river
 * with a gravel bar on each side, the near bank with its dirt track, boulders, W.'s hut and the weathered ferry landing.
 * Same sizes and positions as the lake's pictures, so the scene lays them out with the lake's numbers.
 */


// ---- Geometry the scene and the tests share ------------------------------------------------------

/** How far the gravel bars rise above the straight shoreline, and where they start (left bar ends at x 96, right one starts at x 284). */
export const BAR = { leftEdge: 96, leftRise: 78, rightEdge: 284, rightRise: 44, rightSpan: 76 };

/** How much the gravel bar lifts the waterline at x (0 in the middle, where the landing and the bobber column are). */
export function barBump(x: number): number {
  if (x < BAR.leftEdge) return BAR.leftRise * Math.pow((BAR.leftEdge - x) / BAR.leftEdge, 1.5);
  if (x > BAR.rightEdge) return BAR.rightRise * Math.pow(Math.min(1, (x - BAR.rightEdge) / BAR.rightSpan), 1.3);
  return 0;
}

/** The waterline (world y of the first gravel) at column x: the lake's wobbly shore, lifted by the bars. */
export function riverWaterline(x: number): number {
  return SHORE_Y + Math.round(2.4 * Math.sin(x / 23) + 1.6 * Math.sin(x / 8.5 + 1)) - Math.round(barBump(x));
}

/** The river's bend as a y offset of the flow at column x: up at the top right where it comes in, lower at the left where it leaves. */
export function riverBend(x: number): number {
  return 20 - 70 * Math.pow(Math.min(1, Math.max(0, x / W)), 1.2);
}

/** Where the bobber settles in the slack water by the left bank (slice 25c); the drift runs from `BOBBER_X` to here. */
export const EDDY_X = 104;

/**
 * How far lower (screen y) a band lies at column x than at the bobber column: the water's ramp shading follows `riverBend(x) * 0.5`
 * (riverRampPos), so a drifting bobber that adds this to its y stays inside its band's curve.
 */
export const bandBendY = (x: number): number => (riverBend(x) - riverBend(BOBBER_X)) * 0.5;

/** The ferry rope: from the post on the landing's left edge up-left to the post on the far bank. */
export const ROPE_POST_POS = { x: 54, baseY: 438 };
export const ROPE_NEAR = { x: ROPE_POST_POS.x + ROPE_POST_KNOT.x, y: ROPE_POST_POS.baseY - ROPE_POST.height + ROPE_POST_KNOT.y };
export const FAR_POST_POS = { x: 69, baseY: farShoreY(69) };
/** The ferry moored at the far post (world top-left of its picture, small because it is far away) and the little stake sign by the rope post. */
export const FERRY = { x: 88, y: farShoreY(100) - 13, w: 32, h: 20 };
export const FERRY_SIGN = { w: 18, h: 24 };
export const FERRY_SIGN_FEET = { x: 44, y: 436 };
export const ferrySignBox = () => ({ x: FERRY_SIGN_FEET.x - FERRY_SIGN.w / 2, y: FERRY_SIGN_FEET.y - FERRY_SIGN.h, w: FERRY_SIGN.w, h: FERRY_SIGN.h });
/** The rope ends at the ferry's pulley, at the top of its mast, right beside the far post. */
export const ROPE_FAR = { x: FERRY.x + 4, y: FERRY.y + 1 };

/** A boulder: bottom-centre position, size, whether it stands in the water (gets the white water V) and whether the picture is mirrored. */
export interface RiverRock {
  x: number;
  y: number;
  size: BoulderSize;
  inWater: boolean;
  flip: boolean;
}

/**
 * The near-bank and shallows boulders: on the gravel bars overlapping the waterline, and in the riffle close to the shore.
 * All of them keep clear of the bobber column (x 236-276), the landing and its posts, the car, sign, crate, camp spots and fetch lawn.
 */
export const RIVER_ROCKS: readonly RiverRock[] = [
  { x: 30, y: 412, size: 'l', inWater: false, flip: false },
  { x: 72, y: 451, size: 'm', inWater: false, flip: true },
  { x: 46, y: 402, size: 'm', inWater: true, flip: false },
  { x: 88, y: 432, size: 's', inWater: true, flip: true },
  { x: 296, y: 370, size: 'm', inWater: true, flip: true },
  { x: 20, y: 350, size: 'l', inWater: true, flip: true },
];

export const rockBox = (r: RiverRock) => ({ x: r.x - BOULDER_SIZES[r.size].w / 2, y: r.y - BOULDER_SIZES[r.size].h, w: BOULDER_SIZES[r.size].w, h: BOULDER_SIZES[r.size].h });

/** The seed each boulder size is drawn with (one texture per size; the scene mirrors it when `flip`). */
export const boulderTextureSprite = (size: BoulderSize) => boulderSprite(size, size === 'l' ? 11 : size === 'm' ? 7 : 3);

// ---- Far bank ------------------------------------------------------------------------------------

/**
 * The far shoreline: the world y where the water starts at column x. A gentle diagonal (the far bank is a little farther on the right, where the
 * river comes from, and closer on the left) with soft irregular waves and a tiny gravel point near x 150. Never above FAR_SHORE_Y (172) and, across
 * the bobber column (x 236-276), never below ~179, so the farthest cast always lands in water. The far bank, the water and the reflection share it.
 */
export function farShoreY(x: number): number {
  const slope = 13 * (1 - x / W);
  const waves = 0.8 * (1 + Math.sin(x / 21 + 0.5)) + 0.6 * (1 + Math.sin(x / 8.3 + 2));
  const point = 4 * Math.exp(-(((x - 150) / 9) ** 2));
  const bump = 2.5 * Math.exp(-(((x - 316) / 8) ** 2));
  return Math.round(FAR_SHORE_Y + slope + waves + point + bump);
}
/** The far shoreline's gravel point (x range). */
export const FAR_POINT = { x0: 140, x1: 160 };
/** The raster of the far bank is taller than the lake's, because the shoreline dips lower on the left. */
const FS_H = 120;

/** A far-side farmstead: whitewashed cottage with a red roof and chimney, a lit-at-night window, a fence and a path to the jetty. */
export const COTTAGE = { x: 34, w: 34, h: 28 };
/** The sprite is the cottage with a short fence to its left. */
const COTTAGE_SPRITE_W = 46;
const COTTAGE_FENCE_W = 12;
/** The cottage's feet (world y of its walls' bottom): just above the far shoreline. */
export const cottageFeetY = (): number => {
  let low = 999;
  for (let x = COTTAGE.x - COTTAGE_FENCE_W; x <= COTTAGE.x + COTTAGE.w; x++) low = Math.min(low, farShoreY(x));
  return low - 2; // above the shoreline along its whole width
};
/** Whether column x of the far reflection lies under the farmstead (its reflection is kept short and faint). */
export const underFarmstead = (x: number) => x >= COTTAGE.x - COTTAGE_FENCE_W - 2 && x < COTTAGE.x + COTTAGE.w + 2;
export const cottageBox = () => ({ x: COTTAGE.x, y: cottageFeetY() - COTTAGE.h, w: COTTAGE.w, h: COTTAGE.h });
/** The window (local to the cottage body) that glows at night; its world place follows. */
const COTTAGE_WINDOW_LOCAL = { x: 8, y: 17, w: 6, h: 6 };
export const cottageWindow = () => ({ x: COTTAGE.x + COTTAGE_WINDOW_LOCAL.x, y: cottageFeetY() - COTTAGE.h + COTTAGE_WINDOW_LOCAL.y, w: COTTAGE_WINDOW_LOCAL.w, h: COTTAGE_WINDOW_LOCAL.h });

/** The cottage and its fence as a sprite (origin: the fence's left end). */
function cottageSprite(): Sprite {
  const r = new Raster(COTTAGE_SPRITE_W, COTTAGE.h);
  const ox = COTTAGE_FENCE_W;
  // Roof: a red gable with tile rows, a darker eave line and a chimney.
  for (let y = 0; y < 12; y++) {
    const half = 3 + Math.round(y * 1.35);
    const cx = ox + COTTAGE.w / 2;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const row = y % 3 === 0 ? PAL.redDark : PAL.red;
      r.set(x, y, (x + y) % 4 === 0 ? PAL.redLight : row);
    }
  }
  r.rect(ox + 1, 11, COTTAGE.w - 2, 1, PAL.redDark);
  r.rect(ox + 22, 0, 4, 7, PAL.stoneDark);
  r.rect(ox + 22, 0, 1, 7, PAL.stone);
  r.rect(ox + 21, 0, 6, 1, PAL.outlineSoft);
  // Walls: whitewash with a shaded right side, stone footing.
  r.rect(ox + 3, 12, COTTAGE.w - 6, COTTAGE.h - 12, PAL.white);
  r.rect(ox + COTTAGE.w - 9, 12, 6, COTTAGE.h - 12, PAL.whiteShade);
  r.rect(ox + 3, 12, COTTAGE.w - 6, 1, PAL.cream);
  r.rect(ox + 3, COTTAGE.h - 2, COTTAGE.w - 6, 2, PAL.stoneDark);
  // Window with a cross and dark frame, a plank door.
  const w = COTTAGE_WINDOW_LOCAL;
  r.rect(ox + w.x - 1, w.y - 1, w.w + 2, w.h + 2, PAL.woodDark);
  r.rect(ox + w.x, w.y, w.w, w.h, PAL.shallow2);
  r.rect(ox + w.x + 2, w.y, 1, w.h, PAL.woodDark);
  r.rect(ox + w.x, w.y + 2, w.w, 1, PAL.woodDark);
  r.rect(ox + 23, 19, 5, 7, PAL.woodDeep);
  r.rect(ox + 24, 20, 3, 6, PAL.woodDark);
  // A short fence to the left: posts and two rails.
  r.rect(0, 20, COTTAGE_FENCE_W, 1, PAL.woodLight);
  r.rect(0, 23, COTTAGE_FENCE_W, 1, PAL.woodLight);
  for (let x = 0; x < COTTAGE_FENCE_W; x += 4) r.rect(x, 18, 1, 8, PAL.wood);
  const s: Sprite = { width: r.width, height: r.height, pixels: new Int32Array(r.width * r.height) };
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) s.pixels[y * r.width + x] = r.get(x, y);
  return s;
}

/**
 * A low far bank: hazy hills peeking over, willows and alders, a muddy and stony edge that follows `farShoreY`, a gravel point,
 * a whitewashed cottage with a fence and a path down to the far jetty, and the far ferry post.
 */
export function riverFarBankRaster(): Raster {
  const r = new Raster(W, FS_H);
  const rnd = mulberry32(4242);
  const base = (x: number) => farShoreY(Math.min(W - 1, Math.max(0, x))) - FAR_SHORE_TOP; // local row of the first water row
  // A low hazy ridge behind the trees, so the sky does not run straight into them.
  for (let x = 0; x < W; x++) {
    const bx = base(x);
    const h = 20 + 5 * Math.sin(x / 41 + 1) + 3 * Math.sin(x / 13);
    const crest = Math.round(bx - h);
    for (let y = crest; y < bx; y++) {
      const depth = y - crest;
      let c: number = depth === 0 ? lerpColor(PAL.hillFar, PAL.white, 0.25) : PAL.hillFar;
      if (depth > 8 && bayer(x, y) < (depth - 8) / 12) c = PAL.hillFarDark;
      r.set(x, y, c);
    }
  }
  // The bank itself: a green strip with a mud and stone lip (gravel at the point) in the three rows above the water.
  for (let x = 0; x < W; x++) {
    const bx = base(x);
    const top = bx - 10 - Math.round(1.5 * Math.sin(x / 9));
    for (let y = top; y < bx - 3; y++) {
      const depth = y - top;
      r.set(x, y, depth === 0 ? PAL.leaf : depth < 3 ? PAL.leafDark : PAL.leafDeep);
    }
    const gravel = x >= FAR_POINT.x0 && x < FAR_POINT.x1;
    r.set(x, bx - 3, gravel ? PAL.stoneLight : rnd() < 0.5 ? PAL.woodDark : PAL.leafDeep);
    r.set(x, bx - 2, gravel ? (x % 2 === 0 ? PAL.stone : PAL.sand) : rnd() < 0.35 ? PAL.stone : rnd() < 0.5 ? PAL.woodDark : PAL.sandDark);
    r.set(x, bx - 1, gravel ? PAL.sandDark : rnd() < 0.4 ? PAL.stoneDark : PAL.woodDeep);
  }
  const haze = { color: PAL.hillFar, t: 0.45 };
  // Back row of alders, hazy.
  for (let x = -4; x < W; x += 9 + Math.floor(rnd() * 8)) {
    r.blit(ALDER, x, base(x + 6) - 8 - ALDER.height + Math.floor(rnd() * 3), { mix: haze, flip: rnd() < 0.5 });
  }
  // Front row: willows whose fronds touch the water, alders and low bushes between them. The cottage and the jetty keep their own gap.
  let x = -8;
  const cottage = cottageBox();
  while (x < W + 4) {
    const roll = rnd();
    const sp = roll < 0.26 ? WILLOW_BIG : roll < 0.46 ? WILLOW : roll < 0.62 ? ALDER_BIG : roll < 0.8 ? ALDER : roll < 0.92 ? ALDER_LOW : BUSH;
    const mid = x + sp.width / 2;
    const skip = mid > cottage.x - COTTAGE_FENCE_W - 4 && mid < JETTY.x + JETTY.w + 2; // clearing for the farmstead and the landing
    if (!skip) r.blit(sp, x, base(mid) - sp.height, { flip: rnd() < 0.5 });
    x += Math.max(9, Math.floor(sp.width * (0.55 + rnd() * 0.4)));
  }
  // A few small rocks on the bank's edge.
  for (const [rx, size, sd] of [[250, 's', 3], [316, 's', 5], [206, 's', 9]] as const) {
    r.blit(boulderSprite(size, sd), rx, base(rx) - BOULDER_SIZES[size].h, { flip: sd % 2 === 1 });
  }
  // The farmstead: cottage and fence, hazed a little like the rest of the far bank, and a sandy path along the shore to the jetty.
  const sp = cottageSprite();
  r.blit(sp, cottage.x - COTTAGE_FENCE_W, cottageFeetY() - FAR_SHORE_TOP - COTTAGE.h + 0, { mix: { color: PAL.hillFar, t: 0.18 } });
  for (let px = cottage.x + 16; px < JETTY.x + 4; px++) {
    const by = base(px);
    r.set(px, by - 4, bayer(px, 1) < 0.5 ? PAL.sandLight : PAL.sand);
    r.set(px, by - 3, bayer(px, 2) < 0.5 ? PAL.sand : PAL.sandDark);
  }
  // The far ferry post, in front of the trees (the rope ends at the ferry's pulley beside it).
  r.blit(FAR_POST, FAR_POST_POS.x, FAR_POST_POS.baseY - FAR_POST.height - FAR_SHORE_TOP);
  // The bank is drawn over the water layers, so nothing of it may hang below the shoreline (trees and rocks are wider than one column).
  for (let cx = 0; cx < W; cx++) {
    for (let y = base(cx); y < FS_H; y++) r.data[(y * r.width + cx) * 4 + 3] = 0;
  }
  return r;
}

/** The far bank's reflection: the bank mirrored about the far shoreline, wobbly, dim and streaky; origin (0, FAR_SHORE_Y) so it follows `farShoreY`. */
export function riverFarReflectionRaster(bank: Raster, frame: number): Raster {
  const height = 64;
  const r = new Raster(W, height);
  const phase = frame * 2.1;
  for (let x = 0; x < W; x++) {
    const sh = farShoreY(x);
    const home = underFarmstead(x);
    for (let ry = 0; ry < (home ? 10 : 46); ry++) {
      const ty = sh - FAR_SHORE_Y + ry;
      if (ty >= height) break;
      const sy = sh - FAR_SHORE_TOP - 1 - ry;
      if (sy < 0) break;
      const dx = Math.round(Math.sin(ry * 0.6 + phase) * (1 + ry / 24));
      const c = bank.get(x - dx, sy);
      if (c < 0) continue;
      if (bayer(x, ry) > (home ? (1 - ry / 10) * 0.45 : (1 - ry / 46) * 1.15)) continue;
      if ((ry + Math.round(phase)) % 5 === 0 && bayer(x + ry, ry) > 0.45) continue;
      r.set(x, ty, lerpColor(c, PAL.deep0, home ? 0.7 : 0.5));
    }
  }
  return r;
}

// ---- The far landing: a short jetty the ferry is moored against ----------------------------------

export const JETTY = { x: 72, w: 16, h: 18 };
/** The jetty's top: just above the far shoreline at its place. */
export const jettyBox = () => ({ x: JETTY.x, y: farShoreY(JETTY.x + JETTY.w / 2) - 4, w: JETTY.w, h: JETTY.h });

/** A short plank jetty running out from the far bank toward the viewer, with two piles at the end. */
export function jettyRaster(): Raster {
  const r = new Raster(JETTY.w, JETTY.h);
  for (let y = 0; y < JETTY.h - 3; y++) {
    for (let x = 2; x < JETTY.w - 2; x++) {
      let c: number = y % 3 === 0 ? PAL.woodDark : y % 2 === 0 ? PAL.woodLight : PAL.wood;
      if (x === 2 || x === JETTY.w - 3) c = PAL.woodDark;
      r.set(x, y, c);
    }
  }
  r.rect(2, JETTY.h - 4, JETTY.w - 4, 1, PAL.woodDeep);
  for (const x of [1, JETTY.w - 4]) {
    r.rect(x, JETTY.h - 7, 3, 7, PAL.woodDark);
    r.rect(x, JETTY.h - 7, 1, 6, PAL.wood);
    r.rect(x, JETTY.h - 8, 3, 1, PAL.outline);
  }
  for (let x = 0; x < JETTY.w; x++) if (bayer(x, 5) < 0.6) r.set(x, JETTY.h - 1, PAL.foam, 150);
  return r;
}
export function jettyReflectionRaster(): Raster {
  const r = new Raster(JETTY.w, 8);
  const src = jettyRaster();
  for (let ry = 0; ry < 8; ry++) {
    if (ry % 3 === 2) continue;
    const shift = Math.round(Math.sin(ry * 1.2));
    for (let x = 0; x < JETTY.w; x++) {
      const c = src.get(x - shift, JETTY.h - 2 - ry);
      if (c < 0 || bayer(x, ry) > 0.95 - ry / 10) continue;
      r.set(x, ry, lerpColor(c, PAL.deep0, 0.55));
    }
  }
  return r;
}

// ---- River water ---------------------------------------------------------------------------------

const WATER_RAMP = [PAL.deep0, PAL.deep1, PAL.deep2, PAL.shallow0, PAL.shallow1, PAL.shallow2, PAL.shallow3];

/** Ramp position for a world y at column x: dark pool under the far bank, the seam, the lighter riffle; the zone edges follow the bend and are smooth, not bands. */
function riverRampPos(x: number, y: number): number {
  const poolEdge = distanceToY(RIVER_BEND.zones[1].toM); // 26 m
  const seamEdge = distanceToY(RIVER_BEND.zones[0].toM); // 12 m
  const e = y - riverBend(x) * 0.5;
  const wl = riverWaterline(x);
  let pos: number;
  if (e < poolEdge) pos = 0.15 + 1.9 * ((e - FAR_SHORE_Y) / (poolEdge - FAR_SHORE_Y));
  else if (e < seamEdge) pos = 2.05 + 1.5 * ((e - poolEdge) / (seamEdge - poolEdge));
  else pos = 3.55 + 1.7 * Math.min(1, (e - seamEdge) / Math.max(1, wl - seamEdge));
  // Shallow gravel at the edge.
  if (y > wl - 9) pos += (1 - (wl - y) / 9) * 1.2;
  return pos;
}

/** A pebbly pixel of the near gravel, a pure function of the position so the water and bank pictures meet without a seam. */
export function gravelColor(x: number, y: number): number {
  const h = (Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663)) >>> 0;
  const v = (h % 1000) / 1000;
  if (v < 0.1) return PAL.stoneLight;
  if (v < 0.2) return PAL.stoneDark;
  if (v < 0.25) return PAL.sandDark;
  if (v < 0.29) return PAL.sand;
  return PAL.stone;
}

/** A pixel of the bank from the waterline down (`d` rows below it): foam lip, a wet dark band, then dry pebbles. */
function bankPixel(x: number, y: number, d: number): number {
  if (d < 0) return (x + y) % 2 === 0 ? PAL.foam : PAL.stoneLight;
  if (d < 2) return (x + d) % 3 === 0 ? PAL.stone : PAL.stoneDark;
  return gravelColor(x, y);
}

/** The river: a bend (zones shift with it), a gravel bar curving in on each side of the water, soft current marks. Static; the foam moves on top. */
export function riverWaterRaster(): Raster {
  const h = WATER_BOTTOM - FAR_SHORE_Y;
  const r = new Raster(W, h);
  const rnd = mulberry32(77);
  for (let ly = 0; ly < h; ly++) {
    const wy = FAR_SHORE_Y + ly;
    for (let x = 0; x < W; x++) {
      const wl = riverWaterline(x);
      if (wy < farShoreY(x)) continue; // the far bank shows through above the shoreline
      if (wy >= wl - 1) {
        r.set(x, ly, bankPixel(x, wy, wy - wl));
        continue;
      }
      // A little noise so the gradient breaks into dithered flecks, not rows.
      const n = (bayer(x * 3, ly * 2) - 0.5) * 0.35;
      r.set(x, ly, rampDither(WATER_RAMP, riverRampPos(x, wy) + n, x, ly));
    }
  }
  // Current marks: short dashes along the flow, lighter and darker than the local water, a bit slanted with the bend.
  for (let i = 0; i < 420; i++) {
    const x = 4 + Math.floor(rnd() * (W - 12));
    const wy = FAR_SHORE_Y + 8 + Math.floor(rnd() * (SHORE_Y - FAR_SHORE_Y - 20));
    if (wy > riverWaterline(x) - 6 || wy < farShoreY(x) + 3 || x > rightBankEdge(wy) - 3) continue;
    const len = 3 + Math.floor(rnd() * 7);
    const pos = Math.round(riverRampPos(x, wy));
    const idx = Math.min(WATER_RAMP.length - 1, Math.max(0, pos + (rnd() < 0.6 ? 1 : -1)));
    for (let k = 0; k < len; k++) {
      const yy = wy + Math.round(((riverBend(x + k) - riverBend(x)) * 0.5));
      if (yy - FAR_SHORE_Y >= 0 && yy < riverWaterline(x + k) - 3) r.set(x + k, yy - FAR_SHORE_Y, WATER_RAMP[idx]);
    }
  }
  // Current lanes: faint lighter ribbons along the bend, in dashes, so the flow reads even in a still picture.
  for (const lane of [0.12, 0.26, 0.4, 0.54, 0.68, 0.82, 0.94]) {
    const persp = 0.4 + 0.6 * lane;
    const baseY = FAR_SHORE_Y + 16 + Math.pow(lane, 1.2) * (SHORE_Y - FAR_SHORE_Y - 40);
    for (let x = 0; x < W; x++) {
      const wy = Math.round(baseY + riverBend(x) * persp);
      if (wy > riverWaterline(x) - 7 || x > rightBankEdge(wy) - 2 || wy < farShoreY(x) + 3) continue;
      if (((x >> 3) + Math.floor(lane * 10)) % 3 === 0) continue; // gaps between dashes
      for (let k = 0; k < (lane > 0.3 ? 2 : 1); k++) {
        const ly = wy + k - FAR_SHORE_Y;
        if (bayer(x, ly) < 0.6) {
          const idx = Math.min(WATER_RAMP.length - 1, Math.round(riverRampPos(x, wy)) + 3);
          r.set(x, ly, WATER_RAMP[idx]);
        }
      }
    }
  }
  return r;
}

// ---- The point by the hut ----------------------------------------------------------------------------

/** The point's layer place (world), drawn over the water: its trees overhang no further left than x 284 (the bobber column ends at 276). */
export const RIGHT_BANK = { x: 272, y: 320, w: 88, h: 140 };
/** Where the point's rounded nose begins (world y). Above it the water reaches the right screen edge all the way from the far shore. */
export const SPIT_TIP_Y = 384;
/** Where the nose has become the full body of the point. */
const SPIT_BODY_Y = 406;
/**
 * Where the point's land starts at world y (x from there to the screen edge is bank). Above SPIT_TIP_Y there is none. The nose is a rounded
 * quarter-ellipse leaving the right screen edge, then the shore sweeps right again toward the gravel bar, with small bulges.
 */
export function rightBankEdge(y: number): number {
  if (y < SPIT_TIP_Y) return W + 40;
  const t = Math.min(1.25, Math.max(0, (y - SPIT_BODY_Y) / 46));
  const wobble = (4 * Math.sin(y / 9 + 0.6) + 2 * Math.sin(y / 4.3 + 2)) * Math.min(1, t * 3) * 0.8;
  const body = Math.round(318 + 40 * Math.pow(t, 1.5) + wobble);
  if (y >= SPIT_BODY_Y) return Math.max(306, body);
  const s = (SPIT_BODY_Y - y) / (SPIT_BODY_Y - SPIT_TIP_Y);
  return Math.round(W - (W - 318) * Math.sqrt(Math.max(0, 1 - s * s)));
}
/** True where a world point is land of the point. */
export const isRightLand = (x: number, y: number) => x >= rightBankEdge(y);

/**
 * Whether a world point is open water of the river: below the far shoreline, above the gravel along the near bank and left of the point. The sun and moon
 * glitter, the sparkles and the rain rings are drawn only here, never over the far bank, the farmstead, the point, the hut or the gravel. `pad` keeps them off the edges.
 */
export function onOpenWater(x: number, y: number, pad = 2): boolean {
  return y >= farShoreY(x) + pad && y < riverWaterline(x) - pad && x < rightBankEdge(y) - pad;
}

const scaled = new Map<string, Sprite>();
/** A tree sprite at a perspective scale (cached). */
function treeAt(sp: Sprite, name: string, scale: number): Sprite {
  const k = Math.round(scale * 10) / 10;
  const key = name + k;
  let s = scaled.get(key);
  if (!s) {
    s = k === 1 ? sp : scaleSprite(sp, k);
    scaled.set(key, s);
  }
  return s;
}

/**
 * The point (the inside of the bend) round the hut: a rounded nose, a pebbly beach strip, roots and stones, shaded ground, and a few willows and
 * alders (the hut stands in front of them), with willows leaning out so their fronds hang over the water.
 */
export function riverRightBankRaster(): Raster {
  const r = new Raster(RIGHT_BANK.w, RIGHT_BANK.h);
  const rnd = mulberry32(5150);
  const lx = (x: number) => x - RIGHT_BANK.x;
  const ly = (y: number) => y - RIGHT_BANK.y;
  const GROUND = [PAL.leafDeep, PAL.leafDark, PAL.leaf, PAL.grass1, PAL.grass2];
  const bottom = RIGHT_BANK.y + RIGHT_BANK.h;
  for (let y = SPIT_TIP_Y; y < bottom; y++) {
    const e = rightBankEdge(y);
    const t = Math.min(1, Math.max(0, (y - SPIT_TIP_Y) / 60));
    const beach = 2 + Math.round(3 * t) + (Math.imul(y, 2654435761) >>> 31);
    for (let x = e; x < RIGHT_BANK.x + RIGHT_BANK.w; x++) {
      const dx = x - e;
      const h = (Math.imul(x + 5, 73856093) ^ Math.imul(y + 9, 19349663)) >>> 0;
      const v = (h % 1000) / 1000;
      let c: number;
      if (dx < 1) c = v < 0.5 ? PAL.woodDeep : PAL.stoneDark;
      else if (dx < beach) c = v < 0.2 ? PAL.stoneLight : v < 0.45 ? PAL.stone : v < 0.62 ? PAL.sandDark : v < 0.82 ? PAL.woodDark : PAL.stoneDark;
      else {
        const near = Math.max(0, 1 - (dx - beach) / 16);
        const pos = (0.35 + 0.5 * t + near * 0.6) * 3.2 + (bayer(x, y) - 0.5) * 0.9;
        c = rampDither(GROUND, pos, x, y);
        if (v < 0.07 && dx < beach + 9) c = PAL.woodDark;
      }
      r.set(lx(x), ly(y), c);
    }
  }
  // Roots and stones at the water's edge.
  for (let y = SPIT_TIP_Y + 6; y < 440; y += 8 + Math.floor(rnd() * 5)) {
    const e = rightBankEdge(y);
    const len = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < len; k++) r.set(lx(e - 1 - k), ly(y + (k > 1 ? 1 : 0)), k % 2 === 0 ? PAL.woodDark : PAL.woodDeep);
  }
  for (const [by, sz, sd] of [[392, 's', 3], [416, 'm', 7], [438, 's', 9]] as const) {
    r.blit(boulderSprite(sz, sd), lx(rightBankEdge(by) - 3), ly(by) - BOULDER_SIZES[sz].h, { flip: sd % 2 === 1 });
  }
  // A small wood behind the hut, and willows leaning out over the water.
  type Tree = { sp: Sprite; by: number; cx: number; flip: boolean };
  const trees: Tree[] = [];
  for (let by = SPIT_TIP_Y + 4; by <= 412; by += 5) {
    for (let k = 0; k < 2; k++) {
      const alder = rnd() < 0.5;
      const sp = alder ? treeAt(ALDER, 'a', 1.1) : treeAt(WILLOW, 'w', 1.1);
      trees.push({ sp, by: by + Math.floor(rnd() * 4), cx: Math.max(318, rightBankEdge(by) + 6) + k * 18 + rnd() * 10, flip: rnd() < 0.5 });
    }
  }
  for (const [by, sp, flip] of [[392, WILLOW_NEAR, false]] as const) {
    // Stands on the nose just above the hut's roof, so its fronds hang over the water to the left of the hut.
    trees.push({ sp, by, cx: rightBankEdge(by) + 2, flip });
  }
  trees.sort((p, q) => p.by - q.by);
  for (const tr of trees) {
    const x = Math.max(284, Math.round(tr.cx - tr.sp.width / 2));
    r.blit(tr.sp, lx(x), ly(tr.by) - tr.sp.height, { flip: tr.flip });
  }
  return r;
}

/** The point's reflection: the bank mirrored sideways across its edge, short, dimmed and streaky, in three wobble frames. World origin (RIGHT_BANK.x, RIGHT_BANK.y). */
export function riverRightReflectionRaster(bank: Raster, frame: number): Raster {
  const r = new Raster(RIGHT_BANK.w, RIGHT_BANK.h);
  const phase = frame * 2.1;
  for (let ry = SPIT_TIP_Y - RIGHT_BANK.y; ry < RIGHT_BANK.h; ry++) {
    const y = RIGHT_BANK.y + ry;
    const e = rightBankEdge(y);
    if ((ry + Math.round(phase)) % 4 === 0) continue; // ripple gaps
    for (let dx = 1; dx <= 12; dx++) {
      const wob = Math.round(Math.sin(y * 0.5 + phase) * 1.4);
      const src = bank.get(e + dx + wob - RIGHT_BANK.x, y - 3 - Math.floor(dx / 3) - RIGHT_BANK.y);
      if (src < 0) continue;
      if (bayer(e - dx, y) > 1 - dx / 14) continue;
      if (e - dx < 282) continue;
      r.set(e - dx - RIGHT_BANK.x, ry, lerpColor(src, PAL.deep0, 0.55));
    }
  }
  return r;
}

// ---- Near bank -----------------------------------------------------------------------------------

/** The dirt track: from the left edge to where the car parks (the car stands at x 0-84, y 494-552). */
const TRACK = { y: 532, half: 14, endX: 98 };

const GRASS = new Set<number>([PAL.grass0, PAL.grass1, PAL.grass2, PAL.grass3]);

/** The near bank: a pebbled gravel bar along the waterline (rising on the sides), grass behind it, the dirt track coming in from the left. */
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
  // Where the bar lifts the waterline, repaint the gravel from the new waterline down to the grass.
  for (let x = 0; x < W; x++) {
    const wl = riverWaterline(x) - NEAR_SHORE_TOP; // local row of the waterline
    let grassRow = -1;
    for (let y = 20; y < r.height; y++) {
      if (GRASS.has(r.get(x, y))) {
        grassRow = y;
        break;
      }
    }
    if (grassRow < 0 || barBump(x) < 1) continue;
    for (let y = Math.max(0, wl - 2); y < grassRow; y++) {
      const d = y - wl;
      if (y === wl - 2) r.set(x, y, PAL.foam, 150);
      else r.set(x, y, bankPixel(x, y + NEAR_SHORE_TOP, d));
    }
  }
  // A few pebbles and tufts on the bars.
  const rnd = mulberry32(909);
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rnd() * (W - 4));
    if (barBump(x) < 8) continue;
    const y = Math.floor(rnd() * 40);
    if (y + NEAR_SHORE_TOP > riverWaterline(x) + 6 && rnd() < 0.5) r.blit(rnd() < 0.5 ? TUFT_A : TUFT_B, x, y + 10);
    else if (y + NEAR_SHORE_TOP > riverWaterline(x) + 3) {
      r.rect(x, y, 2, 1, PAL.stoneLight);
      r.rect(x, y + 1, 2, 1, PAL.stoneDark);
    }
  }
  // The dirt track.
  const top = NEAR_SHORE_TOP;
  for (let x = 0; x <= TRACK.endX; x++) {
    const taper = x < 70 ? 1 : Math.max(0.2, 1 - (x - 70) / 40);
    const cy = TRACK.y - Math.round(5 * Math.sin(x / 26));
    const half = Math.round(TRACK.half * taper);
    for (let y = cy - half; y <= cy + half; y++) {
      const ly = y - top;
      const edge = y === cy - half || y === cy + half;
      const rut = (y === cy - Math.round(half * 0.5) || y === cy + Math.round(half * 0.5)) && x % 7 !== 0;
      let c: number = edge ? PAL.sandDark : PAL.sand;
      if (rut) c = PAL.woodLight;
      else if (!edge && bayer(x, y) < 0.12) c = PAL.sandDark;
      else if (!edge && bayer(x + 1, y) > 0.94) c = PAL.sandLight;
      if (edge && bayer(x, y) < 0.35) continue; // ragged verge
      r.set(x, ly, c);
    }
  }
  return r;
}

// ---- W.'s hut ------------------------------------------------------------------------------------

/** About 1.5x the old hut: its right part runs off the screen edge; the sign, window, door and stove pipe are all on screen. */
export const HUT_SIZE = { w: 96, h: 68 };
/** Where the hut stands (feet, bottom middle): on the right bar, behind the notice-board sign (x 258-294, y 460+) and the windsock (y 452+). */
export const HUT_FEET = { x: 336, y: 452 };
export const HUT_BOX = { x: HUT_FEET.x - HUT_SIZE.w / 2, y: HUT_FEET.y - HUT_SIZE.h, w: HUT_SIZE.w, h: HUT_SIZE.h };
/** Where the stove pipe's mouth is in the hut picture, and in the world: a steam wisp for the story goes here later. */
export const HUT_PIPE_TOP_LOCAL = { x: 66, y: 2 };
export const HUT_PIPE_TOP = { x: HUT_BOX.x + HUT_PIPE_TOP_LOCAL.x, y: HUT_BOX.y + HUT_PIPE_TOP_LOCAL.y };
/** The parts that must be on screen (local boxes of the hut picture). */
export const HUT_PARTS = {
  sign: { x: 3, y: 36, w: 24, h: 20 },
  window: { x: 31, y: 38, w: 14, h: 12 },
  door: { x: 48, y: 36, w: 14, h: 32 },
  pipe: { x: 64, y: 2, w: 5, h: 18 },
  kettle: { x: 55, y: 8, w: 8, h: 8 },
};

/** A 3 x 5 pixel font for the sign: "W" and ".". */
const W_GLYPH = ['1.1', '1.1', '1.1', '111', '1.1'];

/** W.'s hut: weathered grey-brown planks, a low tarred roof with an overhang, a window, a door, a stove pipe with a rusty kettle, and a plank sign with "W." and a painted fish. */
export function hutRaster(): Raster {
  const HW = HUT_SIZE.w;
  const HH = HUT_SIZE.h;
  const r = new Raster(HW, HH);
  const rnd = mulberry32(31);
  const wallTop = 26;
  // Walls: vertical plank boards in a few weathered tones.
  const tones = [lerpColor(PAL.wood, PAL.stone, 0.35), lerpColor(PAL.woodLight, PAL.stone, 0.35), lerpColor(PAL.woodDark, PAL.stone, 0.25)];
  for (let x = 4; x < HW - 4; x++) {
    const board = Math.floor((x - 4) / 6);
    const base = tones[(board * 5 + 1) % 3];
    for (let y = wallTop; y < HH; y++) {
      let c = base;
      if ((x - 4) % 6 === 5) c = PAL.woodDark; // gap between boards
      else if ((x - 4) % 6 === 0 && bayer(x, y) < 0.5) c = lerpColor(base, PAL.woodHi, 0.25);
      else if (bayer(x, y) < 0.08) c = PAL.woodDark;
      r.set(x, y, c);
    }
    if ((x - 4) % 6 === 2) {
      r.set(x, wallTop + 5, PAL.stoneDark);
      r.set(x, HH - 8, PAL.stoneDark);
    }
    if (rnd() < 0.1) r.rect(x, wallTop + 10 + Math.floor(rnd() * 26), 1, 2, PAL.woodDeep);
  }
  // Damp stain along the foot and a stone footing.
  for (let x = 4; x < HW - 4; x++) if (bayer(x, 1) < 0.7) r.set(x, HH - 5, PAL.woodDark);
  r.rect(2, HH - 3, HW - 4, 3, PAL.stoneDark);
  for (let x = 2; x < HW - 2; x += 4) r.rect(x, HH - 3, 3, 1, PAL.stone);
  // Low roof: a slanted tarred plane with a lit lip and a shaded eave under it.
  const roofTop = 12;
  for (let y = roofTop; y < wallTop; y++) {
    const inset = Math.round(((wallTop - y) / (wallTop - roofTop)) * 6);
    for (let x = inset; x < HW - inset; x++) {
      const row = y - roofTop;
      let c: number = row % 4 === 0 ? lerpColor(PAL.stoneDark, PAL.outlineSoft, 0.5) : PAL.stoneDark;
      if ((x + row * 3) % 11 === 0) c = PAL.stone;
      r.set(x, y, c);
    }
  }
  r.rect(0, wallTop - 1, HW, 1, PAL.outline);
  r.rect(1, wallTop, HW - 2, 2, PAL.woodDeep); // the eave's shadow on the wall
  r.rect(6, roofTop, HW - 12, 1, PAL.stoneLight);
  // Plank sign (left): "W." in dark paint at 2x and a painted fish.
  const sg = HUT_PARTS.sign;
  r.rect(sg.x, sg.y, sg.w, sg.h, PAL.woodDeep);
  r.rect(sg.x + 1, sg.y + 1, sg.w - 2, sg.h - 2, PAL.woodLight);
  r.rect(sg.x + 1, sg.y + 1, sg.w - 2, 1, PAL.woodHi);
  r.rect(sg.x + 1, sg.y + sg.h - 3, sg.w - 2, 2, PAL.wood);
  W_GLYPH.forEach((row, gy) => {
    for (let gx = 0; gx < 3; gx++) if (row[gx] === '1') r.rect(sg.x + 3 + gx * 2, sg.y + 4 + gy * 2, 2, 2, PAL.woodDeep);
  });
  r.rect(sg.x + 10, sg.y + 12, 2, 2, PAL.woodDeep);
  // The fish: a blue body, a tail, an eye and a pale belly.
  r.rect(sg.x + 13, sg.y + 6, 7, 5, PAL.shallow1);
  r.rect(sg.x + 14, sg.y + 5, 5, 1, PAL.shallow1);
  r.rect(sg.x + 14, sg.y + 11, 5, 1, PAL.shallow1);
  r.rect(sg.x + 14, sg.y + 9, 5, 1, PAL.foam);
  r.rect(sg.x + 20, sg.y + 5, 2, 2, PAL.shallow1);
  r.rect(sg.x + 20, sg.y + 10, 2, 2, PAL.shallow1);
  r.rect(sg.x + 21, sg.y + 7, 1, 3, PAL.shallow1);
  r.set(sg.x + 15, sg.y + 7, PAL.outline);
  // Window: a four-pane window with warm glass, a sill and a plank shutter.
  const wn = HUT_PARTS.window;
  r.rect(wn.x, wn.y, wn.w, wn.h, PAL.woodDeep);
  r.rect(wn.x + 1, wn.y + 1, wn.w - 2, wn.h - 2, PAL.cream);
  r.rect(wn.x + 1, wn.y + 1, wn.w - 2, 3, lerpColor(PAL.cream, PAL.shallow3, 0.5));
  r.rect(wn.x + 6, wn.y + 1, 2, wn.h - 2, PAL.woodDark);
  r.rect(wn.x + 1, wn.y + 6, wn.w - 2, 1, PAL.woodDark);
  r.rect(wn.x - 2, wn.y + wn.h, wn.w + 4, 2, PAL.woodLight);
  // Door: a darker plank door with a handle and a worn step.
  const dr = HUT_PARTS.door;
  r.rect(dr.x, dr.y, dr.w, dr.h, PAL.woodDeep);
  r.rect(dr.x + 1, dr.y + 1, dr.w - 2, dr.h - 1, PAL.woodDark);
  for (const x of [dr.x + 5, dr.x + 9]) r.rect(x, dr.y + 1, 1, dr.h - 1, PAL.woodDeep);
  r.rect(dr.x + 1, dr.y + 1, dr.w - 2, 1, PAL.wood);
  r.rect(dr.x + 10, dr.y + 16, 2, 2, PAL.gold);
  r.rect(dr.x - 2, HH - 1, dr.w + 4, 1, PAL.stone);
  // Stove pipe through the roof, with a cap, and a rusty kettle hanging beside it.
  const pp = HUT_PARTS.pipe;
  r.rect(pp.x, pp.y, pp.w, pp.h, PAL.stoneDark);
  r.rect(pp.x, pp.y, 1, pp.h, PAL.stone);
  r.rect(pp.x - 1, pp.y, pp.w + 2, 2, PAL.outlineSoft);
  r.rect(pp.x - 1, pp.y + 12, pp.w + 2, 1, PAL.stone);
  const kt = HUT_PARTS.kettle;
  r.rect(kt.x, kt.y + 1, kt.w - 1, kt.h - 1, PAL.gingerDark); // body
  r.rect(kt.x, kt.y + 1, 3, kt.h - 1, PAL.ginger);
  r.rect(kt.x + 1, kt.y, kt.w - 3, 1, PAL.gingerDark); // lid
  r.set(kt.x + 3, kt.y - 1, PAL.stoneDark); // knob
  r.rect(kt.x - 2, kt.y + 2, 2, 1, PAL.gingerDark); // spout
  r.set(kt.x - 3, kt.y + 1, PAL.gingerDark);
  r.rect(kt.x + kt.w - 1, kt.y + 2, 2, 1, PAL.outlineSoft); // handle to the pipe
  r.set(kt.x + 2, kt.y + 5, PAL.red); // a rusty patch
  r.set(kt.x + 4, kt.y + 6, PAL.red);
  return r;
}

// ---- The ferry sign and the ferry ----------------------------------------------------------------

/** A small stake sign by the rope post: a painted boat and an arrow pointing across the river (18 x 24, origin bottom-centre at FERRY_SIGN_FEET). */
export function ferrySignRaster(): Raster {
  const r = new Raster(FERRY_SIGN.w, FERRY_SIGN.h);
  // The stake and its shadow.
  r.rect(8, 11, 2, 12, PAL.woodDark);
  r.set(8, 11, PAL.wood);
  r.rect(7, 22, 4, 1, PAL.outline, 90);
  r.rect(6, 23, 6, 1, PAL.outline, 60);
  // The board.
  r.rect(0, 0, 18, 12, PAL.outline);
  r.rect(1, 1, 16, 10, PAL.woodLight);
  r.rect(1, 1, 16, 1, PAL.woodHi);
  r.rect(1, 9, 16, 2, PAL.wood);
  // A boat: mast, sail, hull.
  r.rect(5, 2, 1, 6, PAL.woodDeep);
  r.rect(6, 3, 1, 1, PAL.white);
  r.rect(6, 4, 2, 1, PAL.white);
  r.rect(6, 5, 3, 1, PAL.white);
  r.rect(2, 7, 7, 1, PAL.woodDeep);
  r.rect(3, 8, 5, 1, PAL.woodDeep);
  // An arrow across the water, up and to the right.
  r.rect(10, 5, 4, 1, PAL.woodDeep);
  r.set(13, 4, PAL.woodDeep);
  r.set(13, 6, PAL.woodDeep);
  r.set(14, 3, PAL.woodDeep);
  r.set(14, 7, PAL.woodDeep);
  r.set(14, 5, PAL.woodDeep);
  r.set(15, 5, PAL.woodDeep);
  return r;
}

/**
 * The ferry, moored against the far bank by the far post, small and far away (32 x 20): a flat plank deck seen from above and in front, a low rail,
 * a crate, and a mast at the left with the pulley the rope runs to (ROPE_FAR is that pulley).
 */
export function ferryRaster(): Raster {
  const r = new Raster(FERRY.w, FERRY.h);
  // Deck: a trapezoid, narrower at the far edge, planks running left to right.
  for (let y = 10; y <= 16; y++) {
    const u = (y - 10) / 6;
    const x0 = Math.round(5 - 3 * u);
    const x1 = Math.round(28 + 3 * u);
    for (let x = x0; x <= x1; x++) {
      let c: number = y % 2 === 0 ? PAL.woodLight : PAL.wood;
      if ((x + y * 3) % 9 === 0) c = PAL.woodDark; // a plank end
      if (x === x0 || x === x1) c = PAL.woodDark;
      r.set(x, y, c);
    }
  }
  // Hull front: dark planks, a lit top edge, a foam line at the water.
  r.rect(2, 17, 30, 2, PAL.woodDark);
  r.rect(2, 17, 30, 1, PAL.wood);
  r.rect(2, 19, 30, 1, PAL.woodDeep);
  for (let x = 2; x < 32; x += 3) r.set(x, 18, PAL.woodDeep);
  for (let x = 1; x < 32; x++) if (bayer(x, 3) < 0.6) r.set(x, 19, PAL.foam, 150);
  // Low rail along the back with posts, and short side rails.
  r.rect(5, 7, 24, 1, PAL.woodLight);
  for (const x of [5, 12, 18, 24, 28]) r.rect(x, 7, 1, 4, PAL.woodDark);
  r.rect(5, 8, 24, 1, PAL.woodDark);
  // A crate and a coil of rope on the deck.
  r.rect(21, 11, 5, 4, PAL.woodDeep);
  r.rect(22, 12, 3, 2, PAL.woodDark);
  r.rect(22, 11, 3, 1, PAL.woodHi);
  r.rect(9, 13, 4, 2, PAL.sandDark);
  r.set(10, 13, PAL.sand);
  // The mast and its pulley (left), and the mooring line to the far post.
  r.rect(3, 2, 2, 9, PAL.woodDark);
  r.rect(3, 2, 1, 9, PAL.wood);
  r.rect(2, 0, 4, 3, PAL.stoneDark);
  r.set(3, 1, PAL.stoneLight);
  r.set(4, 1, PAL.stone);
  r.set(0, 12, PAL.sandDark);
  r.set(1, 12, PAL.sandDark);
  r.set(2, 11, PAL.sandDark);
  return r;
}

/** The ferry's reflection: the lower deck and hull mirrored under it, dim and wobbly. */
export function ferryReflectionRaster(): Raster {
  const r = new Raster(FERRY.w, 10);
  const src = ferryRaster();
  for (let ry = 0; ry < 10; ry++) {
    const shift = Math.round(Math.sin(ry * 1.1) * 1.2);
    if (ry % 4 === 3) continue;
    for (let x = 0; x < FERRY.w; x++) {
      const c = src.get(x - shift, FERRY.h - 2 - ry);
      if (c < 0 || bayer(x, ry) > 0.95 - ry / 14) continue;
      r.set(x, ry, lerpColor(c, PAL.deep0, 0.55));
    }
  }
  return r;
}

// ---- The ferry landing ---------------------------------------------------------------------------

/** Where the landing is hollowed out: one plank by the shore is broken off (local to the landing picture), clear of Alex, Pajkel's chair and the dog. */
export const LANDING_HOLE = { x: 106, y: 100, w: 18, h: 12 };
/** The two mooring posts' places on the landing (local top-left of their pictures). */
export const MOORING_POSTS = [
  { x: 4, y: 84 },
  { x: 112, y: 84 },
];

/** The old ferry landing: the dock's exact footprint, greyer older planks with moss and stains, a broken plank, two thick mooring posts. */
export function riverLandingRaster(): Raster {
  const r = dockRaster();
  const rnd = mulberry32(808);
  // Grey the wood, a notch toward the stone.
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      const c = r.get(x, y);
      if (c < 0 || r.alphaAt(x, y) < 255 || c === PAL.outline) continue;
      r.set(x, y, lerpColor(c, PAL.stone, c === PAL.woodHi ? 0.55 : 0.5));
    }
  }
  // Stains and moss in the gaps and corners.
  for (let i = 0; i < 90; i++) {
    const x = 5 + Math.floor(rnd() * (DOCK.w - 12));
    const y = 4 + Math.floor(rnd() * (DOCK.h - 6));
    if (r.get(x, y) < 0) continue;
    const moss = y > 70 && rnd() < 0.5;
    r.set(x, y, moss ? PAL.leafDark : PAL.woodDark);
    if (rnd() < 0.5) r.set(x + 1, y, moss ? PAL.leaf : PAL.woodDeep);
  }
  // The broken plank: a jagged bite out of the plank row at the lower right, with splintered ends.
  for (let y = LANDING_HOLE.y; y < LANDING_HOLE.y + LANDING_HOLE.h - 1; y++) {
    const jag = Math.floor(rnd() * 3);
    for (let x = LANDING_HOLE.x + jag; x < LANDING_HOLE.x + LANDING_HOLE.w; x++) {
      const i = (y * r.width + x) * 4;
      r.data[i + 3] = 0;
    }
  }
  r.rect(LANDING_HOLE.x - 1, LANDING_HOLE.y + 1, 2, LANDING_HOLE.h - 3, PAL.woodDeep);
  // Two thick mooring posts on the edge planks, with a soft shadow.
  for (const p of MOORING_POSTS) {
    r.rect(p.x + 1, p.y + MOORING_POST.height - 2, MOORING_POST.width, 3, PAL.outline, 90);
    r.blit(MOORING_POST, p.x, p.y);
  }
  return r;
}

/** The weathered ferry landing's rope post, a standalone picture drawn above the landing (tall, so it leaves the landing's box). */
export const ropePostRaster = (): Raster => Raster.fromSprite(ROPE_POST);

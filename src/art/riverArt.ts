import { lerpColor } from './dayCycle';
import { distanceToY, DOCK, FAR_SHORE_TOP, FAR_SHORE_Y, NEAR_SHORE_TOP, SHORE_Y, W, WATER_BOTTOM } from './layout';
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
  FAR_POST_ROPE_Y,
  MOORING_POST,
  ROPE_POST,
  ROPE_POST_KNOT,
  WILLOW,
  WILLOW_BIG,
  type BoulderSize,
} from './riverSprites';
import { RIVER_BEND } from '../core/data/locations';

/**
 * The River bend's pictures (slice 25b, pure): a low far bank of willows and alders with the far ferry post, the bending river
 * with a gravel bar on each side, the near bank with its dirt track, boulders, W.'s hut and the weathered ferry landing.
 * Same sizes and positions as the lake's pictures, so the scene lays them out with the lake's numbers.
 */

const FS_H = FAR_SHORE_Y + 4 - FAR_SHORE_TOP;
const BASE = FAR_SHORE_Y - FAR_SHORE_TOP;

// ---- Geometry the scene and the tests share ------------------------------------------------------

/** How far the gravel bars rise above the straight shoreline, and where they start (left bar ends at x 96, right one starts at x 284). */
export const BAR = { leftEdge: 96, leftRise: 44, rightEdge: 284, rightRise: 44, rightSpan: 76 };

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
  return 12 - 30 * Math.pow(Math.min(1, Math.max(0, x / W)), 1.3);
}

/** The ferry rope: from the post on the landing's left edge up-left to the post on the far bank. */
export const ROPE_POST_POS = { x: 120, baseY: 378 };
export const ROPE_NEAR = { x: ROPE_POST_POS.x + ROPE_POST_KNOT.x, y: ROPE_POST_POS.baseY - ROPE_POST.height + ROPE_POST_KNOT.y };
export const FAR_POST_POS = { x: 92, baseY: FAR_SHORE_Y + 1 };
export const ROPE_FAR = { x: FAR_POST_POS.x + 1, y: FAR_POST_POS.baseY - FAR_POST.height + FAR_POST_ROPE_Y };

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
  { x: 30, y: 440, size: 'l', inWater: false, flip: false },
  { x: 72, y: 451, size: 'm', inWater: false, flip: true },
  { x: 288, y: 451, size: 's', inWater: false, flip: false },
  { x: 52, y: 420, size: 'm', inWater: true, flip: false },
  { x: 88, y: 432, size: 's', inWater: true, flip: true },
  { x: 288, y: 426, size: 'm', inWater: true, flip: true },
  { x: 14, y: 398, size: 'l', inWater: true, flip: true },
];

export const rockBox = (r: RiverRock) => ({ x: r.x - BOULDER_SIZES[r.size].w / 2, y: r.y - BOULDER_SIZES[r.size].h, w: BOULDER_SIZES[r.size].w, h: BOULDER_SIZES[r.size].h });

/** The seed each boulder size is drawn with (one texture per size; the scene mirrors it when `flip`). */
export const boulderTextureSprite = (size: BoulderSize) => boulderSprite(size, size === 'l' ? 11 : size === 'm' ? 7 : 3);

// ---- Far bank ------------------------------------------------------------------------------------

/** A low far bank: hazy hills peeking over, willows and alders, a muddy and stony edge, a couple of small rocks, the far ferry post. */
export function riverFarBankRaster(): Raster {
  const r = new Raster(W, FS_H);
  const rnd = mulberry32(4242);
  // A low hazy ridge behind the trees, so the sky does not run straight into them.
  for (let x = 0; x < W; x++) {
    const h = 20 + 5 * Math.sin(x / 41 + 1) + 3 * Math.sin(x / 13);
    const crest = Math.round(BASE - h);
    for (let y = crest; y < BASE; y++) {
      const depth = y - crest;
      let c: number = depth === 0 ? lerpColor(PAL.hillFar, PAL.white, 0.25) : PAL.hillFar;
      if (depth > 8 && bayer(x, y) < (depth - 8) / 12) c = PAL.hillFarDark;
      r.set(x, y, c);
    }
  }
  // The bank itself: a green strip with a mud and stone lip at the water.
  for (let x = 0; x < W; x++) {
    const top = BASE - 7 - Math.round(1.5 * Math.sin(x / 9));
    for (let y = top; y < BASE; y++) {
      const depth = y - top;
      r.set(x, y, depth === 0 ? PAL.leaf : depth < 3 ? PAL.leafDark : PAL.leafDeep);
    }
    r.set(x, BASE, rnd() < 0.5 ? PAL.woodDark : PAL.leafDeep);
    r.set(x, BASE + 1, rnd() < 0.35 ? PAL.stone : rnd() < 0.5 ? PAL.woodDark : PAL.sandDark);
    r.set(x, BASE + 2, rnd() < 0.4 ? PAL.stoneDark : PAL.woodDeep);
  }
  const haze = { color: PAL.hillFar, t: 0.45 };
  // Back row of alders, hazy.
  for (let x = -4; x < W; x += 9 + Math.floor(rnd() * 8)) {
    r.blit(ALDER, x, BASE - 5 - ALDER.height + Math.floor(rnd() * 3), { mix: haze, flip: rnd() < 0.5 });
  }
  // Front row: willows whose fronds touch the water, alders and low bushes between them.
  let x = -8;
  while (x < W + 4) {
    const roll = rnd();
    const sp = roll < 0.26 ? WILLOW_BIG : roll < 0.46 ? WILLOW : roll < 0.62 ? ALDER_BIG : roll < 0.8 ? ALDER : roll < 0.92 ? ALDER_LOW : BUSH;
    r.blit(sp, x, BASE + 1 - sp.height, { flip: rnd() < 0.5 });
    x += Math.max(9, Math.floor(sp.width * (0.55 + rnd() * 0.4)));
  }
  // Two small rocks on the bank's edge (the same boulders as the near bank, smaller ones), then the ferry post in front of the trees.
  for (const [rx, size, sd] of [[250, 's', 3], [316, 's', 5], [141, 's', 9]] as const) {
    r.blit(boulderSprite(size, sd), rx, BASE + 3 - BOULDER_SIZES[size].h, { flip: sd % 2 === 1 });
  }
  r.blit(FAR_POST, FAR_POST_POS.x, BASE + 1 - FAR_POST.height);
  return r;
}

// ---- River water ---------------------------------------------------------------------------------

const WATER_RAMP = [PAL.deep0, PAL.deep1, PAL.deep2, PAL.shallow0, PAL.shallow1, PAL.shallow2, PAL.shallow3];

/** Ramp position for a world y at column x: dark pool under the far bank, the seam, the lighter riffle; the zone edges follow the bend and are smooth, not bands. */
function riverRampPos(x: number, y: number): number {
  const poolEdge = distanceToY(RIVER_BEND.zones[1].toM); // 26 m
  const seamEdge = distanceToY(RIVER_BEND.zones[0].toM); // 12 m
  const e = y - riverBend(x) * 0.9;
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
    if (wy > riverWaterline(x) - 6) continue;
    const len = 3 + Math.floor(rnd() * 7);
    const pos = Math.round(riverRampPos(x, wy));
    const idx = Math.min(WATER_RAMP.length - 1, Math.max(0, pos + (rnd() < 0.6 ? 1 : -1)));
    for (let k = 0; k < len; k++) {
      const yy = wy + Math.round(((riverBend(x + k) - riverBend(x)) * 0.5));
      if (yy - FAR_SHORE_Y >= 0 && yy < riverWaterline(x + k) - 3) r.set(x + k, yy - FAR_SHORE_Y, WATER_RAMP[idx]);
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

export const HUT_SIZE = { w: 62, h: 44 };
/** Where the hut stands (feet, bottom middle): on the right bar, behind the notice-board sign (x 258-294, y 460+) and the windsock (y 452+). */
export const HUT_FEET = { x: 329, y: 452 };
export const HUT_BOX = { x: HUT_FEET.x - HUT_SIZE.w / 2, y: HUT_FEET.y - HUT_SIZE.h, w: HUT_SIZE.w, h: HUT_SIZE.h };
/** Where the stove pipe's mouth is in the hut picture, and in the world: a steam wisp for the story goes here later. */
export const HUT_PIPE_TOP_LOCAL = { x: 51, y: 1 };
export const HUT_PIPE_TOP = { x: HUT_BOX.x + HUT_PIPE_TOP_LOCAL.x, y: HUT_BOX.y + HUT_PIPE_TOP_LOCAL.y };

/** A tiny 3 x 5 "W." for the plank sign. */
const W_GLYPH = ['1.1', '1.1', '1.1', '111', '1.1'];

/** W.'s hut: weathered grey-brown planks, a low tarred roof with an overhang, a window, a door, a stove pipe with a rusty kettle, a painted plank sign, a bait bucket. */
export function hutRaster(): Raster {
  const HW = HUT_SIZE.w;
  const HH = HUT_SIZE.h;
  const r = new Raster(HW, HH);
  const rnd = mulberry32(31);
  const wallTop = 16;
  // Walls: vertical plank boards in a few weathered tones.
  const tones = [lerpColor(PAL.wood, PAL.stone, 0.35), lerpColor(PAL.woodLight, PAL.stone, 0.35), lerpColor(PAL.woodDark, PAL.stone, 0.25)];
  for (let x = 3; x < HW - 3; x++) {
    const board = Math.floor((x - 3) / 4);
    const base = tones[(board * 5 + 1) % 3];
    for (let y = wallTop; y < HH; y++) {
      let c = base;
      if ((x - 3) % 4 === 3) c = PAL.woodDark; // gap between boards
      else if (bayer(x, y) < 0.08) c = PAL.woodDark;
      r.set(x, y, c);
    }
    if ((x - 3) % 4 === 1) {
      r.set(x, wallTop + 3, PAL.stoneDark);
      r.set(x, HH - 5, PAL.stoneDark);
    }
    if (rnd() < 0.12) r.set(x, wallTop + 8 + Math.floor(rnd() * 14), PAL.woodDeep);
  }
  // Foot: stones along the bottom.
  r.rect(2, HH - 2, HW - 4, 2, PAL.stoneDark);
  for (let x = 2; x < HW - 2; x += 3) r.set(x, HH - 2, PAL.stone);
  // Low roof: a slanted tarred plane with a lit lip and a shaded eave under it.
  for (let y = 7; y < wallTop; y++) {
    const inset = Math.max(0, Math.round((9 - (y - 7)) * 0.4));
    for (let x = inset; x < HW - inset; x++) {
      const row = y - 7;
      let c: number = row % 3 === 0 ? lerpColor(PAL.stoneDark, PAL.outlineSoft, 0.5) : PAL.stoneDark;
      if ((x + row * 2) % 9 === 0) c = PAL.stone;
      r.set(x, y, c);
    }
  }
  r.rect(0, wallTop - 1, HW, 1, PAL.outline);
  r.rect(1, wallTop, HW - 2, 1, PAL.woodDeep); // the eave's shadow on the wall
  r.rect(4, 7, HW - 8, 1, PAL.stoneLight);
  // Door (right): a darker plank door with a handle and a worn step.
  const dx = HW - 17;
  r.rect(dx, 25, 12, 19, PAL.woodDeep);
  r.rect(dx + 1, 26, 10, 18, PAL.woodDark);
  for (const x of [dx + 4, dx + 7]) r.rect(x, 26, 1, 18, PAL.woodDeep);
  r.rect(dx + 1, 26, 10, 1, PAL.wood);
  r.set(dx + 9, 35, PAL.gold);
  r.rect(dx - 1, HH - 1, 14, 1, PAL.stone);
  // Window (middle): a small four-pane window with a warm glass and a sill.
  r.rect(27, 22, 12, 10, PAL.woodDeep);
  r.rect(28, 23, 10, 8, PAL.cream);
  r.rect(28, 23, 10, 2, lerpColor(PAL.cream, PAL.shallow3, 0.5));
  r.rect(32, 23, 1, 8, PAL.woodDark);
  r.rect(28, 27, 10, 1, PAL.woodDark);
  r.rect(26, 32, 14, 1, PAL.woodLight);
  // The plank sign (left): "W." in dark paint and a little painted fish.
  r.rect(5, 22, 17, 12, PAL.woodDeep);
  r.rect(6, 23, 15, 10, PAL.woodLight);
  r.rect(6, 23, 15, 1, PAL.woodHi);
  r.rect(6, 32, 15, 1, PAL.wood);
  W_GLYPH.forEach((row, gy) => {
    for (let gx = 0; gx < 3; gx++) if (row[gx] === '1') r.set(8 + gx, 25 + gy, PAL.woodDeep);
  });
  r.set(11, 29, PAL.woodDeep);
  // fish: body, tail, eye
  r.rect(14, 27, 5, 3, PAL.shallow1);
  r.set(13, 26, PAL.shallow1);
  r.set(13, 30, PAL.shallow1);
  r.set(19, 28, PAL.shallow1);
  r.set(16, 27, PAL.foam);
  r.set(18, 28, PAL.outline);
  // Stove pipe through the roof, with a cap, and a rusty kettle hanging on it.
  r.rect(50, 1, 4, 10, PAL.stoneDark);
  r.rect(50, 1, 1, 10, PAL.stone);
  r.rect(49, 1, 6, 1, PAL.outlineSoft);
  r.rect(49, 9, 6, 1, PAL.stone);
  r.rect(55, 4, 6, 5, PAL.gingerDark); // kettle body
  r.rect(55, 4, 2, 5, PAL.ginger);
  r.rect(56, 3, 3, 1, PAL.gingerDark); // lid
  r.set(57, 2, PAL.stoneDark); // knob
  r.set(61, 5, PAL.gingerDark); // spout
  r.set(61, 4, PAL.gingerDark);
  r.set(54, 5, PAL.outlineSoft); // handle to the pipe
  r.set(54, 4, PAL.outlineSoft);
  r.set(56, 8, PAL.red); // a rusty patch
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

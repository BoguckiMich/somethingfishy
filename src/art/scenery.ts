import { lerpColor } from './dayCycle';
import { DOCK, FAR_SHORE_TOP, FAR_SHORE_Y, NEAR_SHORE_TOP, SHORE_Y, W, WATER_BOTTOM, ZONE_BOUNDARY_Y } from './layout';
import { PAL } from './palette';
import { bayer, mulberry32, Raster, rampDither } from './raster';
import {
  FLOWER_BLUE,
  FLOWER_PINK,
  FLOWER_WHITE,
  FLOWER_YELLOW,
  PINE_A,
  PINE_B,
  ROUND_A,
  ROUND_B,
  TUFT_A,
  TUFT_B,
} from './sprites';

/** Pure scenery painters: each returns a Raster that the texture layer uploads once. */

// ---- Sky ---------------------------------------------------------------------------------

const SKY_LEVELS = 16;

/** Dithered vertical gradient, top → bottom, in place. */
export function paintSky(r: Raster, top: number, bottom: number): void {
  const ramp: number[] = [];
  for (let i = 0; i < SKY_LEVELS; i++) ramp.push(lerpColor(top, bottom, i / (SKY_LEVELS - 1)));
  for (let y = 0; y < r.height; y++) {
    // Ease so the bright horizon band is wider than the top.
    const t = Math.pow(y / (r.height - 1), 1.35) * (SKY_LEVELS - 1);
    for (let x = 0; x < r.width; x++) r.set(x, y, rampDither(ramp, t, x, y));
  }
}

// ---- Clouds, sun, moon -------------------------------------------------------------------

export function cloudRaster(w: number, h: number, seed: number): Raster {
  const rnd = mulberry32(seed);
  const r = new Raster(w, h);
  const blobs: { x: number; y: number; rad: number }[] = [];
  const n = Math.round(w / 7);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const hump = Math.sin(Math.PI * t);
    const rad = 2.5 + hump * (h * 0.38) + rnd() * 1.2;
    blobs.push({ x: 3 + t * (w - 6), y: h - 2.5 - rad * 0.55, rad });
  }
  for (let x = 0; x < w; x++) {
    let top = -1;
    for (let y = 0; y < h - 1; y++) {
      if (blobs.some((b) => (x - b.x) ** 2 + (y - b.y) ** 2 <= b.rad * b.rad)) {
        if (top < 0) top = y;
        const d = y - top;
        r.set(x, y, d <= 1 ? PAL.cloud : d <= 3 ? PAL.cloudShade : PAL.cloudDark);
      }
    }
    // flat base
    if (top >= 0) r.set(x, h - 1, PAL.cloudDark);
  }
  return r;
}

export function sunRaster(): Raster {
  const size = 31;
  const r = new Raster(size, size);
  const c = 15;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d <= 7.5) r.set(x, y, d <= 5 ? PAL.sun : PAL.sunEdge);
      else if (d <= 14 && bayer(x, y) > (d - 7.5) / 6.5) r.set(x, y, PAL.sun, 70);
    }
  }
  return r;
}

export function moonRaster(): Raster {
  const size = 27;
  const r = new Raster(size, size);
  const c = 13;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d <= 6.5) {
        // shaded limb on the lower right, a couple of craters
        const shade = Math.hypot(x - (c - 2), y - (c - 2));
        r.set(x, y, shade > 6.5 ? PAL.moonDark : shade > 5 ? PAL.moonShade : PAL.moon);
      } else if (d <= 12.5 && bayer(x, y) > (d - 6.5) / 6) r.set(x, y, PAL.moon, 38);
    }
  }
  for (const [x, y] of [[11, 11], [15, 14], [12, 16], [16, 10]]) r.set(x, y, PAL.moonShade);
  return r;
}

// ---- Far shore ---------------------------------------------------------------------------

const FS_H = FAR_SHORE_Y + 4 - FAR_SHORE_TOP; // 80
const BASE = FAR_SHORE_Y - FAR_SHORE_TOP; // local y of world y 150

export function farShoreRaster(): Raster {
  const r = new Raster(W, FS_H);
  const rnd = mulberry32(1337);

  // Distant misty hills, then nearer green hills.
  for (let x = 0; x < W; x++) {
    const hFar = 32 + 9 * Math.sin(x / 43) + 4 * Math.sin(x / 15 + 1);
    const crestFar = Math.round(BASE - hFar);
    for (let y = crestFar; y < BASE; y++) {
      const depth = y - crestFar;
      let c = depth === 0 ? lerpColor(PAL.hillFar, PAL.white, 0.25) : PAL.hillFar;
      if (depth > 12 && bayer(x, y) < (depth - 12) / 14) c = PAL.hillFarDark;
      r.set(x, y, c);
    }
    const hNear = 20 + 6 * Math.sin(x / 31 + 2) + 3 * Math.sin(x / 12);
    const crest = Math.round(BASE - hNear);
    for (let y = crest; y < BASE; y++) {
      const depth = y - crest;
      let c = depth === 0 ? lerpColor(PAL.hill, PAL.leafHi, 0.3) : PAL.hill;
      if (depth > 6 && bayer(x, y) < (depth - 6) / 16) c = PAL.hillDark;
      r.set(x, y, c);
    }
  }

  // Bank.
  for (let x = 0; x < W; x++) {
    r.set(x, BASE - 5, PAL.leafDark);
    r.set(x, BASE - 4, x % 3 === 0 ? PAL.leaf : PAL.leafDark);
    r.set(x, BASE - 3, PAL.leafDark);
    r.set(x, BASE - 2, PAL.leafDeep);
    r.set(x, BASE - 1, PAL.pineDeep);
    r.set(x, BASE, PAL.pineDeep);
    r.set(x, BASE + 1, rnd() < 0.3 ? PAL.stone : PAL.sandDark);
    r.set(x, BASE + 2, rnd() < 0.5 ? PAL.sandDark : PAL.stoneDark);
  }

  const trees = [PINE_A, PINE_B, ROUND_A, ROUND_B, PINE_A, ROUND_A];
  // Back row: smaller, hazier.
  for (let x = -6; x < W; x += 6 + Math.floor(rnd() * 6)) {
    const s = rnd() < 0.5 ? PINE_B : ROUND_B;
    r.blit(s, x, BASE - 3 - s.height, { mix: { color: PAL.hillFar, t: 0.45 }, flip: rnd() < 0.5 });
  }
  // Front row, overlapping.
  for (let x = -8; x < W + 4; x += 8 + Math.floor(rnd() * 10)) {
    if (rnd() < 0.1) x += 14; // occasional clearing
    const s = trees[Math.floor(rnd() * trees.length)];
    r.blit(s, x, BASE + 1 - s.height - Math.floor(rnd() * 2), { flip: rnd() < 0.5 });
  }
  return r;
}

/** Wavy, faded, darkened mirror of the far shore, just under it. */
export function reflectionRaster(shore: Raster, frame: number): Raster {
  const height = 46;
  const r = new Raster(W, height);
  const phase = frame * 2.1;
  for (let ry = 0; ry < height; ry++) {
    const sy = BASE + 2 - ry; // mirror about the waterline
    if (sy < 0) continue;
    const dx = Math.round(Math.sin(ry * 0.6 + phase) * (1 + ry / 24));
    const fade = 1 - ry / height;
    for (let x = 0; x < W; x++) {
      const c = shore.get(x - dx, sy);
      if (c < 0) continue;
      if (bayer(x, ry) > fade * 1.15) continue;
      // horizontal ripple gaps
      if ((ry + Math.round(phase)) % 5 === 0 && bayer(x + ry, ry) > 0.45) continue;
      r.set(x, ry, lerpColor(c, PAL.deep0, 0.5));
    }
  }
  return r;
}

// ---- Water -------------------------------------------------------------------------------

const WATER_RAMP = [PAL.deep0, PAL.deep1, PAL.deep2, PAL.shallow0, PAL.shallow1, PAL.shallow2, PAL.shallow3];

/**
 * World y → position in WATER_RAMP: deep gradient, a dithered transition around the zone
 * boundary, then the shallow gradient.
 */
function waterRampPos(y: number): number {
  const b = ZONE_BOUNDARY_Y;
  const half = 16;
  if (y < b - half) return ((y - FAR_SHORE_Y) / (b - half - FAR_SHORE_Y)) * 2;
  if (y < b + half) return 2 + (y - (b - half)) / (2 * half);
  return 3 + ((y - (b + half)) / (SHORE_Y - (b + half))) * 3;
}

export function waterRaster(): Raster {
  const h = WATER_BOTTOM - FAR_SHORE_Y;
  const r = new Raster(W, h);
  const rnd = mulberry32(99);
  for (let ly = 0; ly < h; ly++) {
    const t = waterRampPos(FAR_SHORE_Y + ly);
    for (let x = 0; x < W; x++) r.set(x, ly, rampDither(WATER_RAMP, t, x, ly));
  }
  // Static wave dashes: a lighter and a darker tone near the local colour.
  for (let i = 0; i < 520; i++) {
    const x = Math.floor(rnd() * W);
    const ly = Math.floor(rnd() * (h - 4));
    const len = 3 + Math.floor(rnd() * 7);
    const pos = Math.round(waterRampPos(FAR_SHORE_Y + ly));
    const light = rnd() < 0.6;
    const idx = Math.min(WATER_RAMP.length - 1, Math.max(0, pos + (light ? 1 : -1)));
    for (let k = 0; k < len; k++) r.set(x + k, ly, WATER_RAMP[idx]);
  }
  return r;
}

// ---- Near shore --------------------------------------------------------------------------

const NS_H = 640 - NEAR_SHORE_TOP;

function shoreLine(x: number): number {
  return SHORE_Y - NEAR_SHORE_TOP + Math.round(2.4 * Math.sin(x / 23) + 1.6 * Math.sin(x / 8.5 + 1));
}

export function nearShoreRaster(): Raster {
  const r = new Raster(W, NS_H);
  const rnd = mulberry32(2024);

  for (let x = 0; x < W; x++) {
    const ys = shoreLine(x);
    const grassStart = ys + 10 + Math.floor(rnd() * 3);
    // foam + wet sand
    if (rnd() < 0.8) r.set(x, ys - 2, PAL.foam, 150);
    r.set(x, ys - 1, (x + ys) % 2 === 0 ? PAL.foam : PAL.sandLight);
    r.set(x, ys, PAL.sandDark);
    r.set(x, ys + 1, PAL.sandDark);
    for (let y = ys + 2; y < NS_H; y++) {
      const v = Math.sin(x / 9) + Math.sin(y / 7 + x / 23) + (rnd() - 0.5) * 0.9;
      if (y < grassStart) {
        let c: number = y < ys + 4 && bayer(x, y) < 0.5 ? PAL.sandDark : PAL.sand;
        if (rnd() < 0.12) c = PAL.sandLight;
        else if (rnd() < 0.05) c = PAL.sandDark;
        r.set(x, y, c);
      } else {
        let c: number = v > 1.15 ? PAL.grass2 : v < -0.75 ? PAL.grass0 : PAL.grass1;
        if (rnd() < 0.025) c = PAL.grass3;
        // darker toward the bottom edge so the hint text stays readable
        if (y > NS_H - 40 && bayer(x, y) < (y - (NS_H - 40)) / 40) c = PAL.grass0;
        r.set(x, y, c);
      }
    }
    // ragged grass edge
    if (x % 2 === 0) r.set(x, grassStart - 1, PAL.grass1);
    if (x % 5 === 0) r.set(x, grassStart - 2, PAL.grass2);
  }

  // Pebbles on the sand.
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rnd() * (W - 4));
    const y = shoreLine(x) + 4 + Math.floor(rnd() * 5);
    r.rect(x, y, 3, 2, PAL.stone);
    r.set(x, y, PAL.stoneLight);
    r.set(x + 1, y, PAL.stoneLight);
    r.rect(x + 1, y + 2, 2, 1, PAL.stoneDark);
  }

  // Tufts and flowers.
  const flowers = [FLOWER_WHITE, FLOWER_PINK, FLOWER_YELLOW, FLOWER_BLUE];
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(rnd() * (W - 6));
    const y = shoreLine(x) + 16 + Math.floor(rnd() * (NS_H - shoreLine(x) - 24));
    r.blit(rnd() < 0.5 ? TUFT_A : TUFT_B, x, y);
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rnd() * (W - 4));
    const y = shoreLine(x) + 18 + Math.floor(rnd() * (NS_H - shoreLine(x) - 30));
    r.blit(flowers[Math.floor(rnd() * flowers.length)], x, y);
  }
  return r;
}

// ---- Dock --------------------------------------------------------------------------------

/** Planks run left-right; the dock extends from the shore (bottom) out into the lake (top). */
export function dockRaster(): Raster {
  const r = new Raster(DOCK.w, DOCK.h);
  const rnd = mulberry32(555);
  const left = 4; // 4 px margin on each side for the shadow
  const width = DOCK.w - 8;

  // Soft shadow on whatever lies beneath.
  for (let y = 4; y < DOCK.h; y++) {
    for (let x = 0; x < DOCK.w; x++) {
      const inside = x >= left && x < left + width;
      if (!inside && (x < left || x >= left + width) && bayer(x, y) < 0.7) r.set(x, y, PAL.outline, 60);
    }
  }

  const tones = [PAL.wood, PAL.woodLight, PAL.wood, PAL.woodLight, PAL.wood];
  const plankH = 8;
  const top = 4;
  const count = Math.floor((DOCK.h - top) / (plankH + 1));
  for (let p = 0; p < count; p++) {
    const y = top + p * (plankH + 1);
    const base = tones[(p * 3 + 1) % tones.length];
    const jitterL = rnd() < 0.35 ? 1 : 0;
    const jitterR = rnd() < 0.35 ? 1 : 0;
    for (let yy = 0; yy < plankH; yy++) {
      for (let xx = jitterL; xx < width - jitterR; xx++) {
        let c: number = base;
        if (yy === 0) c = PAL.woodHi;
        else if (yy === 1 && bayer(xx, yy) < 0.5) c = PAL.woodHi;
        else if (yy >= plankH - 2) c = yy === plankH - 1 ? PAL.woodDark : PAL.wood;
        r.set(left + xx, y + yy, c);
      }
    }
    // grain
    for (let g = 0; g < 4; g++) {
      const gx = Math.floor(rnd() * (width - 14)) + 3;
      const gy = 2 + Math.floor(rnd() * 4);
      const len = 5 + Math.floor(rnd() * 9);
      for (let k = 0; k < len; k++) r.set(left + gx + k, y + gy, PAL.woodDark);
    }
    // a knot now and then
    if (rnd() < 0.3) {
      const kx = 8 + Math.floor(rnd() * (width - 16));
      r.set(left + kx, y + 3, PAL.woodDeep);
      r.set(left + kx + 1, y + 3, PAL.woodDark);
      r.set(left + kx, y + 4, PAL.woodDark);
    }
    // nails
    for (const nx of [3, width - 4]) {
      r.set(left + nx, y + 3, PAL.woodDeep);
      r.set(left + nx - 1, y + 2, PAL.stoneLight);
    }
    // gap between planks
    for (let xx = 0; xx < width; xx++) r.set(left + xx, y + plankH, PAL.woodDeep);
  }

  // Side stringers + outline.
  for (let y = top; y < DOCK.h; y++) {
    r.set(left, y, PAL.outline);
    r.set(left + width - 1, y, PAL.outline);
    r.set(left + 1, y, PAL.woodDark);
    r.set(left + width - 2, y, PAL.woodDark);
  }
  // Far end lip.
  for (let xx = 0; xx < width; xx++) {
    r.set(left + xx, top - 1, PAL.outline);
  }
  return r;
}

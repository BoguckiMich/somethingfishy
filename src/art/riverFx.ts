import { distanceToY, FAR_SHORE_Y, SHORE_Y, W } from './layout';
import { mulberry32 } from './raster';
import { BOULDER_SIZES } from './riverSprites';
import { RIVER_ROCKS, ROPE_FAR, ROPE_NEAR, riverBend, rightBankEdge, riverWaterline, type RiverRock } from './riverArt';

/**
 * Pure positions for the river's moving pictures (slice 25b): foam streaks drifting along the bend, the riffle's standing-wave
 * glints, the ferry rope, and the white water behind the rocks. The scene only draws what these return.
 */

// ---- Tunables ------------------------------------------------------------------------------------

export const STREAK_COUNT = 22;
/** Drift speed in px/s of the farthest and the nearest streak (perspective). */
export const STREAK_SPEED_FAR = 9;
export const STREAK_SPEED_NEAR = 34;
/** Streak lengths (px) far and near. */
export const STREAK_LEN_FAR = 6;
export const STREAK_LEN_NEAR = 28;
/** Rain makes the current this much faster (1 + this * rain visibility). */
export const STREAK_RAIN_BOOST = 0.6;
export const GLINT_COUNT = 16;
/** Glints per rock in the shallows, standing in its wake. */
export const GLINTS_PER_ROCK = 2;
export const ROPE_SEGMENTS = 36;
/** How far the rope hangs below the straight line at mid-span, in px. */
export const ROPE_SAG = 22;
/** Sideways sway at mid-span in px: barely in calm weather, more when it is windy. */
/** How far the rope bows downstream (left) at mid-span, in px, so its hang reads even though it runs nearly straight up the screen. */
export const ROPE_BOW = 13;
export const ROPE_SWAY_CALM = 0.35;
export const ROPE_SWAY_WINDY = 5.5;
/** Rope sway cycle in rad/s (two layered sines). */
export const ROPE_SWAY_SPEED = [1.1, 1.9] as const;

// ---- Foam streaks --------------------------------------------------------------------------------

export interface Streak {
  /** 0 = far lane, 1 = near lane. */
  lane: number;
  phase: number;
}

export function makeStreaks(): Streak[] {
  const rnd = mulberry32(6061);
  const out: Streak[] = [];
  for (let i = 0; i < STREAK_COUNT; i++) {
    // Even spread over the lanes with a little jitter; more of them near (they are bigger and read first).
    const lane = Math.pow((i + 0.5 + (rnd() - 0.5) * 0.7) / STREAK_COUNT, 0.85);
    out.push({ lane, phase: rnd() });
  }
  return out;
}

export interface StreakDraw {
  x: number;
  y: number;
  len: number;
  /** y change over the streak's length (it follows the bend). */
  slope: number;
  alpha: number;
  /** Near streaks are two pixels high. */
  thick: boolean;
}

const laneY = (lane: number) => FAR_SHORE_Y + 16 + Math.pow(lane, 1.2) * (SHORE_Y - FAR_SHORE_Y - 40);

/** Where a streak is at time `t` (seconds), or null when it is hidden (on the gravel bars or off the water). `speedMult` is 1 normally, more in rain. */
export function streakAt(s: Streak, t: number, speedMult: number): StreakDraw | null {
  const speed = (STREAK_SPEED_FAR + (STREAK_SPEED_NEAR - STREAK_SPEED_FAR) * s.lane) * speedMult;
  const span = W + 60;
  const period = span / speed;
  const u = (((t / period + s.phase) % 1) + 1) % 1;
  const x = W + 30 - u * span;
  const persp = 0.4 + 0.6 * s.lane;
  const y = Math.round(laneY(s.lane) + riverBend(x) * persp);
  const len = Math.round(STREAK_LEN_FAR + (STREAK_LEN_NEAR - STREAK_LEN_FAR) * s.lane);
  const slope = Math.round((riverBend(x - len) - riverBend(x)) * persp);
  if (x < -len || x > W + 2) return null;
  const wl = Math.min(riverWaterline(x), riverWaterline(x - len));
  if (y > wl - 4 || y < FAR_SHORE_Y + 6) return null;
  if (x > rightBankEdge(y) - 4) return null;
  // Fade in and out along the path.
  const edge = Math.min(u, 1 - u) * 6;
  const alpha = Math.min(1, edge) * (0.75 + 0.25 * s.lane);
  return { x: Math.round(x), y, len, slope, alpha, thick: s.lane > 0.5 };
}

// ---- Riffle glints -------------------------------------------------------------------------------

export interface RiffleGlint {
  x: number;
  y: number;
  speed: number;
  phase: number;
  w: number;
}

/** Small standing-wave glints on the riffle (0-12 m, the lighter water near her); they flicker in place. A couple stand in each shallow rock's wake. */
export function makeGlints(): RiffleGlint[] {
  const rnd = mulberry32(4711);
  const top = distanceToY(12) + 4;
  const out: RiffleGlint[] = [];
  for (let i = 0; i < GLINT_COUNT; i++) {
    const x = 4 + Math.floor(rnd() * (W - 8));
    const y = top + Math.floor(rnd() * (SHORE_Y - top - 30));
    if (y > riverWaterline(x) - 8 || x > rightBankEdge(y) - 8) continue;
    out.push({ x, y, speed: 2.2 + rnd() * 2.6, phase: rnd() * 6.28, w: 2 + Math.floor(rnd() * 2) });
  }
  for (const rock of RIVER_ROCKS) {
    if (!rock.inWater) continue;
    const { w } = BOULDER_SIZES[rock.size];
    for (let k = 0; k < GLINTS_PER_ROCK; k++) {
      out.push({ x: rock.x - w / 2 - 6 - k * 6, y: rock.y - 1 + (k === 0 ? -2 : 2), speed: 3 + rnd() * 2, phase: rnd() * 6.28, w: 2 });
    }
  }
  return out;
}

/** RiffleGlint strength 0..1 at time t (0 = hidden): a short bright flicker in each cycle. */
export function glintAlpha(g: RiffleGlint, t: number): number {
  const v = Math.sin(t * g.speed + g.phase);
  return v < 0.25 ? 0 : (v - 0.25) / 0.75;
}

// ---- The ferry rope ------------------------------------------------------------------------------

/** Sideways sway in px at mid-span for the weather (`windy` 0..1) at time t. */
export function ropeSway(t: number, windy: number): number {
  const amp = ROPE_SWAY_CALM + (ROPE_SWAY_WINDY - ROPE_SWAY_CALM) * Math.min(1, Math.max(0, windy));
  return amp * (0.7 * Math.sin(t * ROPE_SWAY_SPEED[0]) + 0.3 * Math.sin(t * ROPE_SWAY_SPEED[1] + 1.3));
}

/**
 * The rope as points from the post on the left bank (index 0) to the far post: a straight line hanging ROPE_SAG px at mid-span,
 * swinging sideways by `sway` (zero at both ends). It runs between x 85 and x 130 (+/- the sway), far left of the bobber column.
 */
export function ropePoints(sway: number, n = ROPE_SEGMENTS): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const hump = Math.sin(Math.PI * t);
    out.push({
      x: ROPE_NEAR.x + (ROPE_FAR.x - ROPE_NEAR.x) * t - ROPE_BOW * 4 * t * (1 - t) + sway * hump,
      y: ROPE_NEAR.y + (ROPE_FAR.y - ROPE_NEAR.y) * t + ROPE_SAG * 4 * t * (1 - t) * 0.55 + sway * 0.25 * hump,
    });
  }
  return out;
}

// ---- White water behind rocks --------------------------------------------------------------------

export interface FoamRect {
  x: number;
  y: number;
  w: number;
  alpha: number;
}

/** A V of white water opening to the left (downstream) of a rock in the water, plus a thin ring at its foot, flickering a little. */
export function rockFoam(rock: RiverRock, t: number): FoamRect[] {
  if (!rock.inWater) return [];
  const { w } = BOULDER_SIZES[rock.size];
  const out: FoamRect[] = [];
  const left = Math.round(rock.x - w / 2);
  const foot = rock.y - 1;
  const arms = rock.size === 'l' ? 6 : rock.size === 'm' ? 5 : 4;
  for (let k = 0; k < arms; k++) {
    const flick = 0.55 + 0.45 * Math.sin(t * 3.1 + k * 1.7 + rock.x);
    const len = 5 - (k > 2 ? 2 : k > 0 ? 1 : 0);
    out.push({ x: left - 3 - k * 3 - len + 1, y: foot - 1 - k, w: len, alpha: 0.95 * flick });
    out.push({ x: left - 3 - k * 3 - len + 1, y: foot + 1 + k, w: len, alpha: 0.95 * (0.55 + 0.45 * Math.sin(t * 2.6 + k * 2.1 + rock.x)) });
  }
  // The ring: a thin wet line round its foot, a little wider than the rock.
  out.push({ x: left - 2, y: foot + 1, w: w + 4, alpha: 0.55 + 0.2 * Math.sin(t * 2 + rock.x) });
  return out;
}


/** A streak as short pieces that step down-left with the bend: [{x, y, w}], 6 px each, so a long near streak follows the slope. */
export function streakSegments(d: StreakDraw): { x: number; y: number; w: number }[] {
  const n = Math.max(1, Math.ceil(d.len / 6));
  const out: { x: number; y: number; w: number }[] = [];
  for (let k = 0; k < n; k++) {
    const w = Math.min(6, d.len - k * 6);
    out.push({ x: d.x - k * 6 - w, y: d.y + Math.round((d.slope * (k + 0.5)) / n), w });
  }
  return out;
}

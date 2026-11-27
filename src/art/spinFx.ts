import { BOBBER_X, distanceToY } from './layout';
import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';
import { followerGapM } from '../core/spinning';

/**
 * The look of the spinning retrieve (slice 32), pure numbers for `scenes/SpinView.ts`: where the lure is on screen, how its glint dims as it
 * sinks, how big the follower's shadow is and how far behind the lure it swims, how the rod moves. No Phaser, so it is unit-tested.
 */

/** Where the lure is on screen. `spot` is the river's drift position (x along the run, `dy` the band's bend); at a lake it is the landing column. */
export function lureScreenPos(distanceM: number, depth: number, spot: { x: number; dy: number } = { x: BOBBER_X, dy: 0 }): { x: number; y: number } {
  return { x: spot.x, y: distanceToY(distanceM) + spot.dy + glintLook(depth, false, 0).sinkPx };
}

export interface GlintLook {
  /** 1 at the surface, falling to ~0.3 on the bottom: the lure dims as it sinks. */
  alpha: number;
  /** How far under the surface line it is drawn (px). */
  sinkPx: number;
  /** Share of the way to the deep-water colour (0 surface, 1 bottom). */
  deep: number;
  /** A white twinkle on the blade (only near the surface, and the quicker while it is reeled). */
  sparkle: boolean;
}

/** The glint just under the surface: it sinks a few pixels and dims with `depth` (0 surface .. 1 bottom). */
export function glintLook(depth: number, holding: boolean, elapsedMs: number): GlintLook {
  const d = Math.min(1, Math.max(0, depth));
  const period = holding ? 160 : 520;
  return { alpha: 1 - 0.7 * d, sinkPx: Math.round(1 + 4 * d), deep: d, sparkle: d < 0.55 && Math.floor(elapsedMs / period) % 3 === 0 };
}

/** The colours of each lure's glint: the blade, the body and a shine. */
export const LURE_COLOURS: Readonly<Record<string, { blade: number; body: number; shine: number }>> = {
  spinner: { blade: PAL.stoneLight, body: PAL.redLight, shine: PAL.white },
  wobbler: { blade: PAL.leaf, body: PAL.strawLight, shine: PAL.white },
  jig: { blade: PAL.pink, body: PAL.stone, shine: PAL.white },
};

export interface FollowerPose {
  /** How far behind the lure (up the screen, farther from the dock) the shadow swims (px). */
  gapPx: number;
  /** Length of the shadow along the water (px) and its width. */
  lengthPx: number;
  widthPx: number;
}

/** The shadow's size by the fish's length (15 cm .. 100 cm -> 6 .. 17 px), a little bigger when it is near the dock (perspective). */
export function shadowLengthPx(lengthCm: number, distanceM: number): number {
  const base = 6 + Math.min(1, Math.max(0, (lengthCm - 15) / 85)) * 11;
  const near = 1 + 0.5 * (1 - Math.min(1, distanceM / 30));
  return Math.round(base * near);
}

/** Where the follower is: `followerGapM` metres behind the lure, as pixels up the screen. */
export function followerPose(f: { followMs: number; lengthCm: number }, distanceM: number, dartPx = 0): FollowerPose {
  const gapM = followerGapM(f);
  const gapPx = distanceToY(distanceM) - distanceToY(distanceM + gapM);
  const lengthPx = shadowLengthPx(f.lengthCm, distanceM);
  return { gapPx: Math.max(5, Math.round(gapPx + dartPx)), lengthPx, widthPx: Math.max(3, Math.round(lengthPx * 0.34)) };
}

/** The rod while the lure is in the water: a crank wobble while reeling, a quick jolt on a strike (`jolt` 1 -> 0), a hard bend when snagged. */
export function spinRodMotion(holding: boolean, elapsedMs: number, jolt: number, snag: boolean): { dx: number; dy: number; bend: number } {
  const t = elapsedMs / 1000;
  if (snag) return { dx: 4 + Math.sin(t * 50) * 0.8, dy: 12, bend: 19 };
  const crank = holding ? Math.sin(t * 38) * 0.9 : Math.sin(t * 1.1) * 0.6;
  return {
    dx: 1 + crank + jolt * 5,
    dy: (holding ? 3 : 1) + Math.sin(t * 0.8 + 1) * 0.6 - jolt * 11,
    bend: 4 + (holding ? 2 : 0) + jolt * 9,
  };
}

/** Which crank frame Alex shows while she reels (about 6 frames a second), 0 or 1. */
export const crankFrame = (elapsedMs: number): 0 | 1 => (Math.floor(elapsedMs / 160) % 2 === 0 ? 0 : 1);

/** How long a lure must lie still on the bottom before the idle hint shows (ms). */
export const LIE_HINT_MS = 2000;

/** A lure small enough to hang from Bestia's mouth or lie on the planks where she dropped it (4 x 3, a silver blade and a red bead). */
export const LURE_GLINT: Sprite = sprite(
  `
  .SWS
  SSDR
  .hRr
  `,
  { S: PAL.stoneLight, W: PAL.white, D: PAL.stone, R: PAL.redLight, r: PAL.red, h: PAL.stoneDark },
);

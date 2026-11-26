import { isValidDate } from './daily/dates';
import type { PlayerState } from './inventory';
import type { Rng } from './random';

/** Pebble skipping (slice 26): how a flick turns into skips, where the pebble touches the water, the best-skips record. Pure. */
export const SKIP_TUNING = {
  minSkips: 1,
  maxSkips: 5,
  /** A plain tap throws an ordinary pebble (slice 26b: 2 or 3 skips, a coin flip). */
  tapSkips: [2, 3] as readonly number[],
  /** A swipe that reaches this many skips is Pajkel really going for it: a bigger wind-up (a longer crouch). */
  bigFrom: 3,
  /** A press that moves less than this (px) is a tap. */
  swipeMinPx: 12,
  /** The flick speed is measured over the last this many ms before the release. */
  sampleMs: 110,
  /** Flick speed (px per ms) that reaches 2, 3, 4 and 5 skips; slower is 1. */
  speedSteps: [0.3, 0.7, 1.2, 1.43] as readonly number[],
  /** The first touch-down, the gap to the second (both in m from the dock), and how the gaps shrink. */
  firstM: 5,
  gapM: 5,
  gapDecay: 0.78,
};

export interface FlickSample {
  x: number;
  y: number;
  /** ms, any steady clock. */
  t: number;
}

/** Skips for a flick speed in px per ms (1..5). */
export function skipsForSpeed(pxPerMs: number): number {
  let n: number = SKIP_TUNING.minSkips;
  for (const step of SKIP_TUNING.speedSteps) if (pxPerMs >= step) n++;
  return Math.min(SKIP_TUNING.maxSkips, n);
}

/**
 * The flick's speed (px per ms): the fastest stretch of at most `sampleMs` anywhere in the drag (2026-11-26: it was the
 * last stretch only, but a thumb slows down just before it lifts, so a real flick on a phone read as slow).
 * Fewer than two samples = 0.
 */
export function flickSpeed(samples: readonly FlickSample[]): number {
  let best = 0;
  for (let end = 1; end < samples.length; end++) {
    const last = samples[end];
    let first = last;
    for (let i = end - 1; i >= 0 && last.t - samples[i].t <= SKIP_TUNING.sampleMs; i--) first = samples[i];
    const dt = last.t - first.t;
    if (dt > 0) best = Math.max(best, Math.hypot(last.x - first.x, last.y - first.y) / dt);
  }
  return best;
}

export interface Throw {
  skips: number;
  /** Which way it drifts sideways: -1 (left) .. 1 (right), from the swipe; a tap is 0. */
  side: number;
  /** A fast swipe: he winds up bigger (slice 26b). A tap never is. */
  big: boolean;
}

/** A press from `down` to `up` with the drag `samples` (the last one at the release): a tap throws an ordinary pebble (2-3 skips), a swipe by its speed. */
export function throwFor(down: { x: number; y: number }, up: { x: number; y: number }, samples: readonly FlickSample[], rng: Rng = Math.random): Throw {
  const moved = Math.hypot(up.x - down.x, up.y - down.y);
  if (moved < SKIP_TUNING.swipeMinPx) {
    const t = SKIP_TUNING.tapSkips;
    return { skips: t[Math.min(t.length - 1, Math.floor(rng() * t.length))], side: 0, big: false };
  }
  const skips = skipsForSpeed(flickSpeed(samples));
  return { skips, side: Math.max(-1, Math.min(1, (up.x - down.x) / 80)), big: skips >= SKIP_TUNING.bigFrom };
}

/** Where a pebble of `skips` skips touches the water, in m from the dock: one touch-down per skip, then the last one where it sinks. */
export function skipPlan(skips: number): number[] {
  const n = Math.max(SKIP_TUNING.minSkips, Math.min(SKIP_TUNING.maxSkips, Math.floor(skips)));
  const out: number[] = [SKIP_TUNING.firstM];
  let gap = SKIP_TUNING.gapM;
  for (let i = 0; i < n; i++) {
    out.push(out[out.length - 1] + gap);
    gap *= SKIP_TUNING.gapDecay;
  }
  return out;
}

/** "4 skips!" */
export const skipText = (skips: number): string => `${skips} skip${skips === 1 ? '' : 's'}!`;

export const skipsBestOf = (p: PlayerState): number =>
  typeof p.skipsBest === 'number' && p.skipsBest >= 0 ? Math.min(SKIP_TUNING.maxSkips, Math.floor(p.skipsBest)) : 0;

export interface SkipResult {
  player: PlayerState;
  /** Beat her best. */
  record: boolean;
  /** Pajkel says his record line: a record, the first on this real day (and not a lone skip). */
  speak: boolean;
}

/** Stores a finished throw: a new best is kept; Pajkel speaks once per real day, at the first record beaten that day. Never mutates. */
export function noteSkips(p: PlayerState, skips: number, today: string): SkipResult {
  const best = skipsBestOf(p);
  if (skips <= best) return { player: p, record: false, speak: false };
  const speak = skips >= 2 && isValidDate(today) && p.skipsLineDay !== today;
  return {
    player: { ...p, skipsBest: Math.min(SKIP_TUNING.maxSkips, skips), ...(speak ? { skipsLineDay: today } : {}) },
    record: true,
    speak,
  };
}

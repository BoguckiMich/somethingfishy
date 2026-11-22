/**
 * Where Alex is looking: a pure, seeded glance behaviour (no Phaser). While she idles or waits
 * for a bite she looks at the lake and now and then glances left (Pajkel and the dog) or right
 * (along the shore). A nibble or bite snaps her gaze back; during every other fishing phase
 * (charging, casting, fighting, the catch show-off, a lost fish, retrieving) she never glances.
 */
import type { FishingState } from '../core/fishingSession';
import { randRange, type Rng } from '../core/random';

export type LookDir = 'forward' | 'left' | 'right';

export const LOOK_TUNING = {
  minGapMs: 6000,
  maxGapMs: 15000,
  minGlanceMs: 1000,
  maxGlanceMs: 2000,
};

export interface LookState {
  dir: LookDir;
  /** Milliseconds until the current glance ends (if glancing) or the next one starts. */
  timerMs: number;
}

/** Fishing phases in which she is relaxed enough to look around. */
const RELAXED: ReadonlySet<FishingState['kind']> = new Set(['idle', 'waiting']);

const nextGap = (rng: Rng) => randRange(rng, LOOK_TUNING.minGapMs, LOOK_TUNING.maxGapMs);

export function newLook(rng: Rng): LookState {
  return { dir: 'forward', timerMs: nextGap(rng) };
}

export function tickLook(s: LookState, dtMs: number, fishing: FishingState['kind'], rng: Rng): void {
  if (!RELAXED.has(fishing)) {
    s.dir = 'forward';
    s.timerMs = nextGap(rng);
    return;
  }
  s.timerMs -= dtMs;
  if (s.timerMs > 0) return;
  if (s.dir === 'forward') {
    s.dir = rng() < 0.5 ? 'left' : 'right';
    s.timerMs = randRange(rng, LOOK_TUNING.minGlanceMs, LOOK_TUNING.maxGlanceMs);
  } else {
    s.dir = 'forward';
    s.timerMs = nextGap(rng);
  }
}

/** A nibble or bite pulls her eyes straight back to the bobber. */
export function lookEvent(s: LookState, eventType: string, rng: Rng): void {
  if (eventType !== 'nibble' && eventType !== 'bite') return;
  s.dir = 'forward';
  s.timerMs = nextGap(rng);
}

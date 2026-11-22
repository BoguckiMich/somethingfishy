import type { BarGear } from './gear';
import type { Rng } from './random';
import { randRange } from './random';

/**
 * The catch bar (Stardew-style vertical fight). Pure and deterministic: all randomness comes
 * from the injected `rng`, and physics runs in fixed substeps so the frame rate doesn't matter.
 * Positions are normalised: 0 = bottom of the bar, 1 = top.
 */

export type FishPattern = 'smooth' | 'darting' | 'sinker' | 'floater' | 'erratic';
export const FISH_PATTERNS: readonly FishPattern[] = ['smooth', 'darting', 'sinker', 'floater', 'erratic'];

/** What the bar needs to know about the fish: built from the species by `fightProfile`. */
export interface FishProfile {
  pattern: FishPattern;
  /** 0 (docile) .. 1 (legendary). */
  difficulty: number;
}

export interface CatchBarState {
  /** Centre of the catch zone, in [size/2, 1 - size/2]. */
  zone: number;
  /** Zone velocity, bar units per second (positive = up). */
  zoneVel: number;
  fish: number;
  fishVel: number;
  fishTarget: number;
  /** Seconds until the fish picks its next move. */
  fishTimer: number;
  /** Top speed of the current move, bar units per second. */
  fishSpeed: number;
  progress: number;
  holding: boolean;
  elapsedMs: number;
  /** Leftover time that did not fill a whole substep. */
  accMs: number;
}

export type BarResult = 'fighting' | 'caught' | 'lost';

/** [easy, hard] values, blended by the fish's difficulty. */
type Range = [number, number];

interface PatternTuning {
  /** Top speed of a move. */
  speed: Range;
  /** Seconds between moves (randomised by ±30%). */
  interval: Range;
  /** How far a move can go (bar units); ignored by the biased patterns, which pick absolute targets. */
  reach: Range;
  /** How sharply the fish changes speed (1/s). */
  response: number;
}

export const CATCH_BAR_TUNING = {
  /** Fixed physics step. */
  stepMs: 1000 / 120,
  startProgress: 0.3,
  /** Progress per second while the fish is inside the zone. */
  fillPerSec: 0.16,
  /** Progress per second lost while it is outside (times the line's drain). */
  drainPerSec: 0.13,
  /** Zone acceleration (bar units/s²) while holding, and the pull of gravity while released. */
  lift: 2.4,
  gravity: 2.0,
  maxZoneSpeed: 1.7,
  /** Velocity damping (1/s): the zone settles at a terminal speed instead of building up momentum. */
  drag: 4,
  /** Share of speed kept (reversed) when the zone hits the bottom. */
  bottomBounce: 0.35,
  /** The fish counts as inside when its centre is this close to the zone edge. */
  fishTolerance: 0.02,
  /** Fraction by which full bait calm shrinks fish speed and reach (and stretches the pauses). */
  calmEffect: 0.5,
  patterns: {
    smooth: { speed: [0.12, 2.0], interval: [2.4, 0.35], reach: [0.18, 0.9], response: 4 },
    darting: { speed: [0.5, 2.4], interval: [2.2, 1.5], reach: [0.25, 0.6], response: 14 },
    sinker: { speed: [0.12, 2.1], interval: [1.9, 0.28], reach: [0.2, 0.9], response: 4 },
    floater: { speed: [0.12, 1.2], interval: [2.4, 0.5], reach: [0.2, 0.85], response: 4 },
    erratic: { speed: [0.25, 1.15], interval: [0.7, 0.18], reach: [0.2, 0.75], response: 9 },
  } satisfies Record<FishPattern, PatternTuning>,
  /** Difficulty is raised to this power before it scales speed and reach: gentle fish stay gentle, legends bite. */
  difficultyCurve: 0.75,
  /** The line drains faster for the hardest fish: x(1 + this * difficulty^6), so legends punish slips. */
  drainDifficultyBoost: 1.2,
  /** Chance that a sinker/floater picks a target anywhere on the bar instead of its favourite half. */
  strayChance: 0.28,
  /** Fish stay this far from the very ends. */
  fishMargin: 0.03,
};

const T = CATCH_BAR_TUNING;
const lerp = (r: Range, d: number) => r[0] + (r[1] - r[0]) * Math.pow(d, T.difficultyCurve);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function newCatchBar(fish: FishProfile, gear: BarGear, rng: Rng): CatchBarState {
  const s: CatchBarState = {
    zone: gear.zoneSize / 2,
    zoneVel: 0,
    fish: gear.zoneSize * 0.8,
    fishVel: 0,
    fishTarget: gear.zoneSize * 0.8,
    fishTimer: 0.4,
    fishSpeed: 0,
    progress: T.startProgress,
    holding: false,
    elapsedMs: 0,
    accMs: 0,
  };
  pickMove(s, fish, gear, rng);
  s.fishTimer = Math.min(s.fishTimer, 0.6); // the first move comes soon
  return s;
}

export function barResult(s: CatchBarState): BarResult {
  return s.progress >= 1 ? 'caught' : s.progress <= 0 ? 'lost' : 'fighting';
}

/** The fish chooses where to go next, how fast, and for how long. */
function pickMove(s: CatchBarState, fish: FishProfile, gear: BarGear, rng: Rng): void {
  const cfg: PatternTuning = T.patterns[fish.pattern];
  const d = clamp(fish.difficulty, 0, 1);
  const calm = 1 - T.calmEffect * clamp(gear.baitCalm, 0, 1);
  const lo = T.fishMargin;
  const hi = 1 - T.fishMargin;
  const reach = lerp(cfg.reach, d) * calm;
  s.fishSpeed = lerp(cfg.speed, d) * calm;
  s.fishTimer = (lerp(cfg.interval, d) * randRange(rng, 0.7, 1.3)) / calm;

  switch (fish.pattern) {
    case 'smooth':
    case 'erratic':
      s.fishTarget = clamp(s.fish + randRange(rng, -reach, reach), lo, hi);
      break;
    case 'darting': {
      // A dash: a long jump one way, then a pause (the timer).
      let dir = rng() < 0.5 ? -1 : 1;
      const dist = randRange(rng, 0.5, 1) * reach;
      if (s.fish + dir * dist < lo || s.fish + dir * dist > hi) dir = -dir;
      s.fishTarget = clamp(s.fish + dir * dist, lo, hi);
      break;
    }
    case 'sinker':
    case 'floater': {
      const stray = rng() < T.strayChance;
      const favourite = lo + Math.pow(rng(), 1.3) * (0.5 - lo);
      const base = stray ? randRange(rng, 0.1, 0.9) : favourite;
      s.fishTarget = fish.pattern === 'sinker' ? base : 1 - base;
      break;
    }
  }
}

/**
 * Advances the fight by `dtMs`. `holding` is whether the player's thumb is down (applied for the
 * whole tick). Returns a new state; once the fight is decided, the state stops changing.
 */
export function tickCatchBar(
  prev: CatchBarState,
  dtMs: number,
  holding: boolean,
  fish: FishProfile,
  gear: BarGear,
  rng: Rng,
): CatchBarState {
  if (barResult(prev) !== 'fighting') return prev;
  const s: CatchBarState = { ...prev, holding };
  s.accMs += dtMs;
  const h = T.stepMs / 1000;
  const half = gear.zoneSize / 2;
  const cfg: PatternTuning = T.patterns[fish.pattern];
  const drain = T.drainPerSec * gear.lineDrain * (1 + T.drainDifficultyBoost * Math.pow(clamp(fish.difficulty, 0, 1), 6));

  while (s.accMs >= T.stepMs) {
    s.accMs -= T.stepMs;
    s.elapsedMs += T.stepMs;

    // Zone: lift while held, gravity otherwise; clamped at the ends, a soft bounce at the bottom.
    const accel = (holding ? T.lift : -T.gravity) * gear.reelResponse - T.drag * s.zoneVel;
    s.zoneVel = clamp(s.zoneVel + accel * h, -T.maxZoneSpeed, T.maxZoneSpeed);
    s.zone += s.zoneVel * h;
    if (s.zone >= 1 - half) {
      s.zone = 1 - half;
      s.zoneVel = Math.min(0, s.zoneVel);
    } else if (s.zone <= half) {
      s.zone = half;
      s.zoneVel = s.zoneVel < -0.25 ? -s.zoneVel * T.bottomBounce : 0;
    }

    // Fish: ease toward the target; pick a new move when the timer runs out.
    s.fishTimer -= h;
    if (s.fishTimer <= 0) pickMove(s, fish, gear, rng);
    const dx = s.fishTarget - s.fish;
    const wanted = Math.sign(dx) * Math.min(s.fishSpeed, Math.abs(dx) * 3);
    s.fishVel += (wanted - s.fishVel) * Math.min(1, cfg.response * h);
    s.fish += s.fishVel * h;
    if (s.fish <= 0 || s.fish >= 1) {
      s.fish = clamp(s.fish, 0, 1);
      s.fishVel = 0;
    }

    // Progress: fills while the fish is inside the zone, drains whenever it is outside.
    const inside = Math.abs(s.fish - s.zone) <= half + T.fishTolerance;
    s.progress += (inside ? T.fillPerSec : -drain) * h;
    if (s.progress >= 1) {
      s.progress = 1;
      break;
    }
    if (s.progress <= 0) {
      s.progress = 0;
      break;
    }
  }
  return s;
}

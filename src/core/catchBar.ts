import type { BarGear } from './gear';
import type { Rng } from './random';
import { randRange } from './random';

/**
 * The catch bar (Stardew-style vertical fight). Pure and deterministic: all randomness comes
 * from the injected `rng`, and physics runs in fixed substeps so the frame rate doesn't matter.
 * Positions are normalised: 0 = bottom of the bar, 1 = top.
 */

export type FishPattern = 'smooth' | 'darting' | 'sinker' | 'floater' | 'erratic' | 'abyssal';
export const FISH_PATTERNS: readonly FishPattern[] = ['smooth', 'darting', 'sinker', 'floater', 'erratic', 'abyssal'];

/** What the bar needs to know about the fish: built from the species by `fightProfile`. */
export interface FishProfile {
  pattern: FishPattern;
  /** 0 (docile) .. 1 (legendary). */
  difficulty: number;
  /** Trophy fish (slice 23d): outside the green zone for longer than this, in one go, and it slips away. Missing = never. */
  slipAfterMs?: number;
}

export interface CatchBarState {
  /** Centre of the catch zone, in [size/2, 1 - size/2]. */
  zone: number;
  /** Zone velocity, bar units per second (positive = up). */
  zoneVel: number;
  fish: number;
  fishVel: number;
  fishTarget: number;
  /** Abyssal only: the last move was a hard dive (so the next one is the slow climb back). */
  fishDiving: boolean;
  /** Seconds until the fish picks its next move. */
  fishTimer: number;
  /** Top speed of the current move, bar units per second. */
  fishSpeed: number;
  progress: number;
  holding: boolean;
  elapsedMs: number;
  /** Leftover time that did not fill a whole substep. */
  accMs: number;
  /** How long the fish has been outside the zone in one go (resets as soon as it is back inside). */
  outsideMs: number;
  /** The fight ended because the fish slipped away (outside too long), not because the line ran out. */
  slipped: boolean;
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
  /** Multiplies how fast progress fills while the fish is inside the zone (default 1). */
  fill?: number;
  /** Abyssal only: the sudden hard dives that break the long calm drifts (speed/interval/reach above are the drift). */
  dive?: {
    /** Chance that a move is a dive (when the fish is high enough to dive). */
    chance: Range;
    speed: Range;
    /** The dive ends within this height of the bottom. */
    depth: number;
    /** Seconds the fish stays down. */
    hold: Range;
  };
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
    sinker: { speed: [0.12, 2.1], interval: [1.9, 0.28], reach: [0.2, 0.9], response: 4, fill: 1.25 },
    floater: { speed: [0.12, 1.2], interval: [2.4, 0.5], reach: [0.2, 0.85], response: 4 },
    erratic: { speed: [0.25, 1.15], interval: [0.7, 0.18], reach: [0.2, 0.75], response: 9 },
    // Long calm drifts, then a sudden hard dive to the bottom and a slow climb back.
    abyssal: {
      speed: [0.1, 0.3], interval: [2.8, 2.1], reach: [0.1, 0.2], response: 9, fill: 0.4,
      dive: { chance: [0.55, 0.75], speed: [1.2, 2.6], depth: 0.16, hold: [1.2, 1.6] },
    },
  } satisfies Record<FishPattern, PatternTuning>,
  /** Difficulty is raised to this power before it scales speed and reach: gentle fish stay gentle, legends bite. */
  difficultyCurve: 0.75,
  /** The line drains faster for the hardest fish: x(1 + this * difficulty^6), so legends punish slips. */
  drainDifficultyBoost: 1.2,
  /** Chance that a floater picks a target anywhere on the bar instead of its favourite half. */
  strayChance: 0.28,
  /**
   * Same for a sinker, but it grows with difficulty: base + perDifficulty * d. Without this a sinker
   * rests at the bottom, right where a released zone sits, so a player who never touches the screen
   * won 80-99% of catfish and bream (docs/CATCH_MATH_AUDIT.md, B1).
   */
  sinkerStray: { base: 0.28, perDifficulty: 0.65 },
  /** A sinker's favourite band starts this much x difficulty above the bottom, so a resting zone no longer covers it. */
  sinkerFloor: 0.15,
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
    fishDiving: false,
    fishTimer: 0.4,
    fishSpeed: 0,
    progress: T.startProgress,
    holding: false,
    elapsedMs: 0,
    accMs: 0,
    outsideMs: 0,
    slipped: false,
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
    case 'abyssal': {
      const dive = cfg.dive!;
      const wasDiving = s.fishDiving;
      s.fishDiving = false;
      if (wasDiving) {
        // The climb back: one slow, long move up into the middle of the bar.
        s.fishTarget = randRange(rng, 0.4, 0.75);
      } else if (s.fish > 0.35 && rng() < lerp(dive.chance, d)) {
        s.fishDiving = true;
        s.fishTarget = randRange(rng, lo, dive.depth);
        s.fishSpeed = lerp(dive.speed, d) * calm;
        s.fishTimer = (lerp(dive.hold, d) * randRange(rng, 0.8, 1.2)) / calm;
      } else {
        s.fishTarget = clamp(s.fish + randRange(rng, -reach, reach) + (0.55 - s.fish) * 0.5, lo, hi); // drifts around the middle
      }
      break;
    }
    case 'sinker':
    case 'floater': {
      const strayChance = fish.pattern === 'sinker' ? T.sinkerStray.base + T.sinkerStray.perDifficulty * d : T.strayChance;
      const stray = rng() < strayChance;
      // A harder sinker hangs a little higher, just above where a released zone rests.
      const floor = fish.pattern === 'sinker' ? T.sinkerFloor * d : 0;
      const favourite = lo + floor + Math.pow(rng(), 1.3) * (0.5 - lo - floor);
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
    // The reel scales how eagerly the zone responds (lift and gravity) but its damping only by sqrt: the
    // zone gets quicker without overshooting more, so a better reel never makes a fight harder. (Scaling
    // the lift alone, or lift and gravity with the same drag, made bream and catfish harder; audit B3.)
    const accel = (holding ? T.lift : -T.gravity) * gear.reelResponse - T.drag * Math.sqrt(gear.reelResponse) * s.zoneVel;
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
    s.progress += (inside ? T.fillPerSec * (cfg.fill ?? 1) : -drain) * h;
    // A trophy slips the hook when it stays out of the green for too long (slice 23d).
    s.outsideMs = inside ? 0 : s.outsideMs + T.stepMs;
    if (fish.slipAfterMs !== undefined && s.outsideMs > fish.slipAfterMs) {
      s.slipped = true;
      s.progress = 0;
      break;
    }
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

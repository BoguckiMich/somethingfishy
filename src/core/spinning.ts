import type { TimeOfDay } from './clock';
import { advanceDrift, biteRate } from './current';
import type { WeatherEffects } from './daily/weather';
import { speciesById } from './data/fish';
import { RARE_TUNING } from './data/rare';
import { lureById, PREDATORS, SPIN_SPECIES, SPIN_TUNING as T, type Lure } from './data/spinning';
import type { GameEvent } from './events';
import { candidates, rollHookedFish, spawnWeight, type HookedFish } from './fish';
import { poolAt, zoneAt, type Location } from './location';
import type { Rng } from './random';
import { rareCanSpawn } from './rare';

/**
 * The spinning retrieve (slice 32, GAME_DESIGN "Spinning rod"), pure: the state of a cast lure after it landed, seeded `Rng`, no clock.
 * One thumb: holding reels (the lure comes in and runs at its reel depth), letting go pauses (it sinks, in the river it drifts). A
 * predator first FOLLOWS (at least `minFollowMs`), its interest rises and falls with how well the retrieve fits its taste (depth and
 * rhythm, data/spinning.ts), then it STRIKES, most often on the pause just after a burst. A strike with the thumb down hooks at once; with it
 * up the thumb has `hookGraceMs` to go down, else it is a nip and the cast goes on. `core/fishingSession.ts` wraps this in the `spinning`
 * state and starts the normal fight when the outcome is `hooked`.
 */

export interface Follower {
  speciesId: string;
  /** Rolled when it starts following (the shadow's size), kept through the strike and the fight. */
  lengthCm: number;
  weightG: number;
  /** 0..1: it leaves at 0 and may strike from `strikeInterestMin`. */
  interest: number;
  /** How long it has followed (ms): a strike needs `minFollowMs`. */
  followMs: number;
}

export interface SpinState {
  lure: string;
  /** Where the lure landed, and where it is now (metres from the dock; 0 = at the dock: just out). */
  startM: number;
  distanceM: number;
  /** 0 = at the surface, 1 = on the bottom. */
  depth: number;
  /** The thumb is down: reeling. */
  holding: boolean;
  /** How long the current burst (holding) or pause has lasted. */
  phaseMs: number;
  /** Bursts started so far (the pause "just after a burst" needs one). */
  bursts: number;
  /** How long the pause before the current burst lasted (a pike wants a long one before it). */
  lastPauseMs: number;
  /** How long the lure has lain on the bottom with the thumb up (resets when it is reeled). */
  bottomMs: number;
  /** It lay on the bottom for `snagArmMs`: the next reel-in rolls the snag (once). */
  snagArmed: boolean;
  /** Lure time since the last follow roll. */
  checkMs: number;
  follower?: Follower;
  /** A strike with the thumb up: ms left for the thumb to go down. Absent = no strike pending. */
  strikeWindowMs?: number;
  /** After a nip no strike for this long. */
  cooldownMs: number;
  /** River only (a place with a `current`): 0 = just landed .. 1 = settled in the eddy, advancing while paused. */
  drift?: number;
  elapsedMs: number;
}

/** What the retrieve needs to know about the world around the lure. */
export interface SpinEnv {
  location: Location;
  time: TimeOfDay;
  /** The in-game minute (the Ferry pike's rules need it); absent = no Ferry pike. */
  minute?: number;
  fx?: WeatherEffects;
  fotdId?: string;
  /** The river's flow (1 = normal); only a place with a `current` reads it. */
  flow: number;
}

export type SpinOutcome =
  | { kind: 'going' }
  /** The strike set the hook: the session starts the fight with this fish at `distanceM`. */
  | { kind: 'hooked'; hooked: HookedFish }
  /** The lure snagged: it is gone (a `lureLost` event came with it), the session reels the empty line in. */
  | { kind: 'snag' }
  /** The lure reached the dock untouched: back to idle, nothing lost. */
  | { kind: 'out' };

export interface SpinStep {
  spin: SpinState;
  events: GameEvent[];
  outcome: SpinOutcome;
}

const GOING: SpinOutcome = { kind: 'going' };

/** A lure that has just landed: at the surface, the thumb up (it starts to sink). */
export function newSpin(lure: string, distanceM: number, location: Location): SpinState {
  return {
    lure, startM: distanceM, distanceM, depth: 0, holding: false, phaseMs: 0, bursts: 0, lastPauseMs: 1e9, bottomMs: 0, snagArmed: false, checkMs: 0,
    cooldownMs: 0, elapsedMs: 0, ...(location.current ? { drift: 0 } : {}),
  };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 1 when the lure runs at the depth the species follows at, falling to 0 `tol` away. */
export function depthFit(depth: number, speciesId: string): number {
  const sp = SPIN_SPECIES[speciesId];
  return sp ? clamp01(1 - Math.abs(depth - sp.depth) / sp.tol) : 0;
}

/** How well the moment of the retrieve (the burst or the pause so far, and the pause before it) fits the species' rhythm, 0..1. */
export function rhythmFit(s: Pick<SpinState, 'holding' | 'phaseMs' | 'lastPauseMs'>, speciesId: string): number {
  const sp = SPIN_SPECIES[speciesId];
  if (!sp) return 0;
  if (s.holding) {
    const limit = sp.burstMs[1];
    const burst = 1 - clamp01((s.phaseMs - limit) / (limit * 0.5 + 500));
    return burst * (0.4 + 0.6 * pauseFitOf(s.lastPauseMs, speciesId));
  }
  const limit = sp.pauseMs[1];
  return 1 - clamp01((s.phaseMs - limit) / (limit * 0.5 + 500));
}

/** How the lure suits a species in a band of this depth class: the lure's own liking, and the deep bands' extra (the jig and the pool's perch). */
export function lureAffinity(lure: Lure, speciesId: string, fishZone: 'shallow' | 'deep'): number {
  return (lure.likes[speciesId] ?? 1) * (fishZone === 'deep' ? lure.deepLikes?.[speciesId] ?? 1 : 1);
}

/** The lures a predator likes best (affinity 2 or more), for the fish log's "Likes:" row. */
export function favouriteLureIds(speciesId: string, all: readonly Lure[]): string[] {
  return all.filter((l) => (l.likes[speciesId] ?? 1) >= 2).map((l) => l.id);
}

/** Is the lure lying still on the bottom (thumb up)? No follower starts and none strikes then. */
export const lyingStill = (s: Pick<SpinState, 'holding' | 'depth'>): boolean => !s.holding && s.depth >= T.bottomAt;

/** The pause just after a burst: the moment a predator strikes most often. */
export const justAfterBurst = (s: Pick<SpinState, 'holding' | 'bursts' | 'phaseMs'>): boolean => !s.holding && s.bursts > 0 && s.phaseMs <= T.afterBurstMs;

/** How far behind the lure the shadow swims (metres): it closes in while it follows. */
export const followerGapM = (f: Pick<Follower, 'followMs'>): number => Math.max(0.4, 3 - (f.followMs / 1000) * 1.2);

/** The snag chance of one reel-in at this distance: by the band's id (riffle / seam / pool, shallow / deep), else by its depth class. */
export function snagChance(location: Location, distanceM: number): number {
  const band = zoneAt(location, distanceM);
  return T.snagPct[band.id] ?? T.snagPct[band.fishZone];
}

// ---- Following --------------------------------------------------------------------------------------------------------

/**
 * The weighted predators that may follow a lure in this band right now (peaceful fish never; the weights include the lure's taste and its depth).
 * A lure does not care how common a fish is: every predator weighs as an uncommon one, times the band's own say (so the river's seam is mostly asp).
 */
export function followCandidates(lure: Lure, depth: number, distanceM: number, env: SpinEnv): { id: string; w: number }[] {
  const band = zoneAt(env.location, distanceM);
  const pool = poolAt(env.location, distanceM);
  return candidates(band.fishZone, env.time, env.fx, pool)
    .filter((s) => PREDATORS.includes(s.id))
    .map((s) => ({ id: s.id, w: spawnWeight({ ...s, rarity: 'uncommon' }, undefined, env.fotdId, env.fx, pool) * lureAffinity(lure, s.id, band.fishZone) * (0.3 + 0.7 * depthFit(depth, s.id)) }));
}

/** One follow roll: a new follower, or undefined. */
export function rollFollower(s: SpinState, lure: Lure, env: SpinEnv, rng: Rng): Follower | undefined {
  const band = zoneAt(env.location, s.distanceM);
  const cands = followCandidates(lure, s.depth, s.distanceM, env);
  const total = cands.reduce((sum, c) => sum + c.w, 0);
  if (total <= 0) return undefined;
  const seam = biteRate(env.location.current, band.id, s.drift);
  if (rng() >= T.followChance * Math.min(1, total / T.presenceRef) * seam) return undefined;
  let roll = rng() * total;
  let speciesId = cands[cands.length - 1].id;
  for (const c of cands) {
    roll -= c.w;
    if (roll < 0) {
      speciesId = c.id;
      break;
    }
  }
  // The Ferry pike keeps its exact conditions (any bait, so a lure too): when they all hold, it may be the one that follows.
  if (
    env.minute !== undefined &&
    rareCanSpawn('ferryPike', { placeId: env.location.id, bandId: band.id, zone: band.fishZone, distanceM: s.distanceM, minute: env.minute, weather: env.fx?.id }) &&
    rng() < RARE_TUNING.chance * (lure.id === 'jig' ? T.jigFerryMul : 1)
  ) {
    speciesId = 'ferryPike';
  }
  const hooked = rollHookedFish(band.fishZone, env.time, rng, speciesId, undefined, undefined, env.fotdId, env.fx, poolAt(env.location, s.distanceM), T.sizeSkewMul);
  return { speciesId, lengthCm: hooked.lengthCm, weightG: hooked.weightG, interest: T.startInterest, followMs: 0 };
}

const hookedOf = (f: Follower): HookedFish => ({ speciesId: f.speciesId, lengthCm: f.lengthCm, weightG: f.weightG });

// ---- The thumb --------------------------------------------------------------------------------------------------------

/** The thumb went down: a reel burst starts (the soft jig hops), the pending strike is hooked, or - after a long lie on the bottom - the snag is rolled. */
export function pressSpin(s: SpinState, env: SpinEnv, rng: Rng): SpinStep {
  if (s.holding) return { spin: s, events: [], outcome: GOING };
  // A strike waits for the thumb: it sets the hook.
  if (s.strikeWindowMs !== undefined && s.follower) {
    const { strikeWindowMs: _gone, ...rest } = s;
    return { spin: { ...rest, holding: true, phaseMs: 0, bursts: s.bursts + 1, lastPauseMs: s.phaseMs }, events: [], outcome: { kind: 'hooked', hooked: hookedOf(s.follower) } };
  }
  const lure = lureById(s.lure)!;
  const next: SpinState = { ...s, holding: true, phaseMs: 0, bursts: s.bursts + 1, lastPauseMs: s.phaseMs, bottomMs: 0, snagArmed: false, depth: Math.max(0, s.depth - lure.hop) };
  if (s.snagArmed && rng() < snagChance(env.location, s.distanceM)) {
    return {
      spin: next,
      events: [{ type: 'snag', lure: s.lure }, { type: 'lureLost', lure: s.lure, cause: 'snag', bringBack: false }],
      outcome: { kind: 'snag' },
    };
  }
  return { spin: next, events: [], outcome: GOING };
}

/** How well a finished pause of `pauseMs` suits the species (a pike wants a long one before it; the others are not fussy before). */
export function pauseFitOf(pauseMs: number, speciesId: string): number {
  const min = SPIN_SPECIES[speciesId]?.pauseMs[0] ?? 0;
  return min > 0 ? Math.min(1, pauseMs / min) : 1;
}

/** The thumb came up: the lure pauses. */
export function releaseSpin(s: SpinState): SpinState {
  return s.holding ? { ...s, holding: false, phaseMs: 0 } : s;
}

// ---- Time -------------------------------------------------------------------------------------------------------------

/** Advances the retrieve by `dtMs`: the lure moves, a follower comes, warms or cools, strikes; a strike with the thumb up waits its window out. */
export function tickSpin(s0: SpinState, dtMs: number, env: SpinEnv, rng: Rng): SpinStep {
  const lure = lureById(s0.lure)!;
  const events: GameEvent[] = [];
  const dt = dtMs / 1000;
  const s: SpinState = { ...s0, phaseMs: s0.phaseMs + dtMs, elapsedMs: s0.elapsedMs + dtMs };

  // Where the lure is.
  if (s.holding) {
    s.distanceM = Math.max(0, s.distanceM - T.reelMps * dt);
    const step = lure.reelDepthPerS * dt;
    s.depth = s.depth < lure.reelDepth ? Math.min(lure.reelDepth, s.depth + step) : Math.max(lure.reelDepth, s.depth - step);
    s.bottomMs = 0;
  } else {
    if (s.depth < lure.pauseMax) s.depth = Math.min(lure.pauseMax, s.depth + lure.sinkPerS * dt);
    if (s.depth >= T.bottomAt) {
      s.bottomMs += dtMs;
      if (s.bottomMs >= T.snagArmMs) s.snagArmed = true;
    } else {
      s.bottomMs = 0;
    }
  }
  const cur = env.location.current;
  if (cur && s.drift !== undefined) s.drift = s.holding ? Math.max(0, s.drift - T.driftBackPerS * dt) : advanceDrift(s.drift, dtMs, env.flow, cur);
  if (s.distanceM <= 0) {
    delete s.follower;
    delete s.strikeWindowMs;
    return { spin: s, events: [{ type: 'lureOut', lure: s.lure }], outcome: { kind: 'out' } };
  }
  if (s.cooldownMs > 0) s.cooldownMs = Math.max(0, s.cooldownMs - dtMs);

  // A strike with the thumb up that the thumb missed: a nip.
  if (s.strikeWindowMs !== undefined) {
    s.strikeWindowMs -= dtMs;
    if (s.strikeWindowMs <= 0) {
      delete s.strikeWindowMs;
      s.cooldownMs = T.nipCooldownMs;
      if (s.follower) {
        events.push({ type: 'nip', speciesId: s.follower.speciesId });
        s.follower = { ...s.follower, interest: s.follower.interest - T.nipInterestLoss };
      }
    }
  }

  const still = lyingStill(s);
  if (s.follower) {
    const f = { ...s.follower, followMs: s.follower.followMs + dtMs };
    const score = 0.6 * rhythmFit(s, f.speciesId) + 0.4 * depthFit(s.depth, f.speciesId);
    f.interest = Math.min(1, f.interest + (score - T.interestMid) * T.interestRate * dt);
    if (f.interest <= 0) {
      delete s.follower;
      delete s.strikeWindowMs;
      events.push({ type: 'followLost', speciesId: f.speciesId });
    } else {
      s.follower = f;
      if (!still && s.strikeWindowMs === undefined && s.cooldownMs <= 0 && f.followMs >= T.minFollowMs && f.interest >= T.strikeInterestMin) {
        const timing = s.holding ? T.reelMul : justAfterBurst(s) ? T.afterBurstMul : T.laterPauseMul;
        const band = zoneAt(env.location, s.distanceM);
        const hazard = T.strikeRate * f.interest * f.interest * timing * biteRate(cur, band.id, s.drift);
        if (rng() < 1 - Math.exp(-hazard * dt)) {
          if (s.holding) {
            events.push({ type: 'strike', speciesId: f.speciesId, hookGraceMs: 0 });
            return { spin: s, events, outcome: { kind: 'hooked', hooked: hookedOf(f) } };
          }
          s.strikeWindowMs = T.hookGraceMs;
          events.push({ type: 'strike', speciesId: f.speciesId, hookGraceMs: T.hookGraceMs });
        }
      }
    }
  } else if (!still) {
    s.checkMs += dtMs;
    while (s.checkMs >= T.checkMs) {
      s.checkMs -= T.checkMs;
      const f = rollFollower(s, lure, env, rng);
      if (f) {
        s.follower = f;
        events.push({ type: 'follow', speciesId: f.speciesId, lengthCm: f.lengthCm });
        break;
      }
    }
  }
  return { spin: s, events, outcome: GOING };
}

// ---- Losing the lure --------------------------------------------------------------------------------------------------

/**
 * What a snapped line does to the lure: lost with `snapLoseChance` (and 1 in `bringBackOneIn` of those is washed up for Bestia to bring
 * back), else the fish spits it. Rolled once when the fight ends `snapped`; a slip or any other escape keeps the lure (no call).
 */
export function snapFate(lure: string, rng: Rng): GameEvent {
  if (rng() >= T.snapLoseChance) return { type: 'lureSpat', lure };
  return { type: 'lureLost', lure, cause: 'snapped', bringBack: rng() < 1 / T.bringBackOneIn };
}

/** Is this species' name a predator that can follow a lure (for the log row and the quest)? */
export const isPredator = (speciesId: string): boolean => PREDATORS.includes(speciesId) && speciesById(speciesId) !== undefined;

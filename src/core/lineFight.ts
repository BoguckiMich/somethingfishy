import type { FishProfile } from './catchBar';
import { LINE_FIGHT_TUNING, SIGNATURE_MOVES, SIGNATURE_TUNING, type LinePattern, type Range, type SignatureMove } from './data/lineFight';
import type { BarGear } from './gear';
import type { Rng } from './random';
import { randRange } from './random';

/**
 * The "feel the line" fight (slice 28, GAME_DESIGN "Catch mechanic v2"). Pure and deterministic like the catch bar: all randomness
 * comes from the injected `rng`, physics runs in fixed substeps. The fish is at the end of a taut line on the water: holding reels it in
 * (and the line tightens), a surge makes the rod bend and the line go red, so let go and let it run; hold off too long and the line
 * goes slack. It ends when the fish reaches the dock (caught), the hook slips (slack too long) or the line snaps (red too long).
 */

const T = LINE_FIGHT_TUNING;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (r: Range, d: number) => r[0] + (r[1] - r[0]) * Math.pow(d, T.difficultyCurve);

/** What the line fight needs from the gear (derived from the catch-bar gear: the same rod, line, reel and bait). */
export interface LineGear {
  /** The rod's flex budget: seconds in the red before the line snaps. */
  flexS: number;
  /** The line's snap limit: tension at or above it is red. */
  snapLimit: number;
  /** The reel's speed (1 = the starter reel). */
  reel: number;
  /** The bait's calm, 0..1. */
  calm: number;
}

/** Gear mapping: rod zone size → flex, line drain → snap limit, reel response → reel speed, bait calm → calmer surges. */
export function lineGearOf(g: BarGear): LineGear {
  return {
    flexS: Math.max(0.6, T.flexBase + T.flexPerZone * (g.zoneSize - 0.3)),
    snapLimit: clamp(T.snapBase + T.snapPerDrain * (1 - g.lineDrain), 0.5, 0.97),
    reel: g.reelResponse,
    calm: clamp(g.baitCalm, 0, 1),
  };
}

export type SurgePhase = 'calm' | 'warn' | 'hush' | 'run';
export type LineResult = 'fighting' | 'caught' | 'slipped' | 'snapped' | 'escaped';

export interface LineFightState {
  /** Where the fish was hooked, in metres from the dock. */
  startM: number;
  /** Where it is now (0 = at the dock: caught). */
  distanceM: number;
  /** Line tension 0..1: below `slackFloor` is slack, the gold band is steady, at or above the snap limit is red. */
  tension: number;
  /** Sideways position of the fish, -1..1. */
  lateral: number;
  lateralTarget: number;
  /** Seconds to the next sideways cut. */
  cutTimer: number;
  /** A cut is telegraphed: seconds left before the jerk (0 = none), and where it is going. */
  cutWarn: number;
  cutTarget: number;
  /** Seconds the thumb has been up in one go. */
  releasedS: number;
  /** calm → warn (the telegraph) → [hush: a feint goes limp] → run (the pull) → calm. */
  phase: SurgePhase;
  /** Seconds left in the phase. */
  phaseT: number;
  /** Length of the phase, for ramps and the view. */
  phaseTotal: number;
  /** How long the coming surge runs, in seconds (picked at the telegraph). */
  runT: number;
  /** Strength of the surge being telegraphed or run, 0..1. */
  strength: number;
  /** Where the surge makes the fish run sideways: -1 or 1. */
  runDir: number;
  /** Surges still to chain right after this one (a flash). */
  chain: number;
  /** This one is a feint: it goes limp after the splash. */
  feint: boolean;
  /** The signature move of the trophy (none for other fish). */
  signature?: SignatureMove;
  surgeCount: number;
  /** The wobble phase of the steady pull. */
  wobble: number;
  /** Seconds the line has been slack in one go (forgives: drains when it is not). */
  slackS: number;
  /** Seconds of red against the rod's flex budget (drains slower than it builds). */
  redS: number;
  /** All the time in the red / in slack this fight, ms (the perfect catch forgives a short total of each). */
  redTotalMs: number;
  slackTotalMs: number;
  /** Fight time after the first second, and how much of it the needle spent inside the gold (ms): a perfect catch needs `perfectGold` of it. */
  /** The part of a cut's jerk still to be felt (it is spread over `kickS`). */
  kickLeft: number;
  timedMs: number;
  goldMs: number;
  /** The gold band of this fish (tension): narrower the harder the fish. The rules and the gauge both read it. */
  goldLo: number;
  goldHi: number;
  /** Share of the fight time the needle must spend in the gold for a perfect catch: `perfectGold`, lower for the hardest fish. */
  perfectNeed: number;
  /** The fastest the fish could be reeled in (metres per second), to tell when a perfect catch is out of reach. */
  fullReelMps: number;
  holding: boolean;
  elapsedMs: number;
  accMs: number;
  result: LineResult;
}

/** The gold band of a fish: wide for an easy one, narrow for a hard one, narrower still for a trophy. */
export function goldBandOf(fish: Pick<FishProfile, 'difficulty' | 'slipAfterMs'>, gear?: Pick<BarGear, 'zoneSize'>): [number, number] {
  const d = clamp(fish.difficulty, 0, 1);
  let w = T.goldWidth[0] + (T.goldWidth[1] - T.goldWidth[0]) * Math.pow(d, T.goldCurve);
  if (fish.slipAfterMs !== undefined) w = Math.min(w, T.trophyGoldMax);
  // A better rod is more forgiving: a touch wider band (carbon) or narrower (bamboo).
  if (gear) w = clamp(w + T.goldPerZone * (gear.zoneSize - T.goldZoneRef), 0.08, 0.4);
  return [T.goldCenter - w / 2, T.goldCenter + w / 2];
}

/** The gold share a perfect catch needs: 80 % for most fish, down to `perfectGoldHard` for the hardest (from difficulty `perfectEaseFrom` over `perfectEaseOver`). */
export const perfectNeedOf = (difficulty: number): number => T.perfectGold - (T.perfectGold - T.perfectGoldHard) * clamp((difficulty - T.perfectEaseFrom) / T.perfectEaseOver, 0, 1);

export function newLineFight(rng: Rng, startM: number, speciesId?: string, fish?: FishProfile, gear?: BarGear): LineFightState {
  const start = Math.max(1, startM);
  const [goldLo, goldHi] = goldBandOf(fish ?? { difficulty: 0 }, gear);
  return {
    startM: start,
    distanceM: start,
    tension: T.startTension,
    lateral: 0,
    lateralTarget: 0,
    cutTimer: randRange(rng, 0.8, 1.6),
    cutWarn: 0,
    cutTarget: 0,
    releasedS: 0,
    phase: 'calm',
    phaseT: T.firstSurgeS * randRange(rng, 0.8, 1.2),
    phaseTotal: T.firstSurgeS,
    runT: 1,
    strength: 0,
    runDir: 1,
    chain: 0,
    feint: false,
    signature: speciesId ? SIGNATURE_MOVES[speciesId] : undefined,
    surgeCount: 0,
    wobble: rng() * Math.PI * 2,
    slackS: 0,
    redS: 0,
    redTotalMs: 0,
    slackTotalMs: 0,
    kickLeft: 0,
    timedMs: 0,
    goldMs: 0,
    goldLo,
    goldHi,
    perfectNeed: perfectNeedOf(fish?.difficulty ?? 0),
    fullReelMps: start * T.reelBase,
    holding: true, // the hooking press is still down
    elapsedMs: 0,
    accMs: 0,
    result: 'fighting',
  };
}

export const lineResult = (s: LineFightState): LineResult => s.result;

/** Share of the fight (after the first second) the needle has been inside the gold, 0..1 (1 before it counts). */
export const goldShare = (s: LineFightState): number => (s.timedMs > 0 ? s.goldMs / s.timedMs : 1);

/** A perfect catch: won, with no more than a tiny time in the red and the needle in the gold for `perfectGold` of the fight time after the first second. */
export const isPerfectLine = (s: LineFightState): boolean => s.result === 'caught' && s.redTotalMs <= T.perfectRedGraceMs && goldShare(s) >= s.perfectNeed;

/**
 * Live view of the perfect catch for the star: `alive` is false once it can no longer be reached (red beyond its grace, or the gold share could not
 * climb back to the limit even with the needle in the gold for the fastest possible rest of the fight); `glow` is 1 while the share is comfortably above
 * the limit and falls to 0 at it.
 */
export function perfectOutlook(s: LineFightState): { alive: boolean; glow: number; share: number } {
  const share = goldShare(s);
  const restMs = (s.distanceM / Math.max(0.01, s.fullReelMps)) * 1000;
  const best = (s.goldMs + restMs) / (s.timedMs + restMs);
  const alive = s.redTotalMs <= T.perfectRedGraceMs && best >= s.perfectNeed;
  return { alive, share, glow: alive ? clamp((share - s.perfectNeed) / 0.08, 0, 1) : 0 };
}

/** Is the needle inside the gold band? */
export const inGold = (s: LineFightState): boolean => s.tension >= s.goldLo && s.tension < s.goldHi;

/** How well the reel works at this tension, 0..1: slow while slack, full in the gold, falling to nothing at the snap limit (the red). */
export function reelFactor(s: LineFightState, snapLimit: number): number {
  const t = s.tension;
  if (t >= snapLimit) return 0;
  if (t >= s.goldHi) return clamp(1 - (t - s.goldHi) / Math.max(0.01, snapLimit - s.goldHi), 0, 1);
  if (t >= s.goldLo) return 1;
  if (t <= T.slackFloor) return T.slackReel;
  const k = (t - T.slackFloor) / Math.max(0.01, s.goldLo - T.slackFloor);
  return T.slackReel + (1 - T.slackReel) * k * k * (3 - 2 * k);
}

/** How much of the fish's surge pulls on the line right now, 0..1 (the ramps in and out included). */
export function surgeLevel(s: LineFightState): number {
  if (s.phase !== 'run') return 0;
  const into = s.phaseTotal - s.phaseT;
  return s.strength * tire(s.distanceM) * clamp(Math.min(into / T.surgeRamp, s.phaseT / T.surgeRamp + 0.2), 0, 1);
}

/** The fish tires near the dock: its surges weaken over the last metres. */
const tire = (distanceM: number): number => (distanceM >= T.tireM ? 1 : T.tireFloor + (1 - T.tireFloor) * (distanceM / T.tireM));

/** Share of the line reeled in, 0..1. */
export const lineProgress = (s: LineFightState): number => clamp(1 - s.distanceM / s.startM, 0, 1);

/** Is the line in the red right now? */
export const inRed = (s: LineFightState, gear: BarGear): boolean => s.tension >= lineGearOf(gear).snapLimit;
export const isSlack = (s: LineFightState): boolean => s.tension < T.slackFloor;

/** The telegraph, 0..1 (rises over the warning): the view's splash and the haptic pulse follow it. */
export const warnLevel = (s: LineFightState): number => (s.phase === 'warn' && s.phaseTotal > 0 ? 1 - s.phaseT / s.phaseTotal : 0);

const calmFactor = (gear: LineGear) => 1 - T.calmGap * gear.calm;

/** The next calm gap, in seconds. */
function calmGap(cfg: LinePattern, d: number, gear: LineGear, rng: Rng, wide: boolean): number {
  return (lerp(cfg.every, d) * (wide ? randRange(rng, 0.5, 1.5) : randRange(rng, 0.7, 1.3))) / calmFactor(gear);
}

/** The fish gets ready to surge: the telegraph starts. */
function startSurge(s: LineFightState, fish: FishProfile, cfg: LinePattern, gear: LineGear, rng: Rng): void {
  const d = clamp(fish.difficulty, 0, 1);
  const spread = cfg.strengthSpread;
  let strength = lerp(cfg.strength, d) * (1 + spread * (rng() * 2 - 1)) * (1 - T.calmStrength * gear.calm);
  let warn = lerp(cfg.warn, d);
  let run = lerp(cfg.run, d) * randRange(rng, 0.8, 1.2);
  s.feint = false;
  s.chain = 0;
  s.surgeCount++;
  if (s.signature && rng() < 1 / SIGNATURE_TUNING.oneIn) {
    if (s.signature === 'flash') {
      strength = Math.max(strength, 0.75);
      s.chain = 1;
    } else if (s.signature === 'feint') {
      s.feint = true;
      strength = Math.max(strength * 1.5, 1);
    } else {
      strength = SIGNATURE_TUNING.diveStrength;
      warn = SIGNATURE_TUNING.diveWarnS;
      run = SIGNATURE_TUNING.diveRunS;
    }
  }
  s.strength = clamp(strength, 0.15, 1);
  s.phase = 'warn';
  s.phaseT = s.phaseTotal = warn;
  s.runDir = rng() < 0.5 ? -1 : 1;
  s.runT = run;
}

/**
 * Advances the fight by `dtMs`. `holding` is whether the thumb is down for the whole tick. Returns a new state;
 * once the fight is decided it stops changing.
 */
export function tickLineFight(
  prev: LineFightState,
  dtMs: number,
  holding: boolean,
  fish: FishProfile,
  barGear: BarGear,
  rng: Rng,
): LineFightState {
  if (prev.result !== 'fighting') return prev;
  const s: LineFightState = { ...prev, holding };
  s.accMs += dtMs;
  const h = T.stepMs / 1000;
  const cfg: LinePattern = T.patterns[fish.pattern];
  const d = clamp(fish.difficulty, 0, 1);
  const gear = lineGearOf(barGear);
  const trophy = fish.slipAfterMs !== undefined;
  const flexS = gear.flexS * (trophy ? T.trophyFlex : 1);
  const slackLimit = trophy ? T.trophySlackS : T.slackS;
  [s.goldLo, s.goldHi] = goldBandOf(fish, barGear);
  s.perfectNeed = perfectNeedOf(d);
  const reelRate = s.startM * T.reelBase * gear.reel * (1 - T.reelHeavy * d) * (T.reelEasy + (1 - T.reelEasy) * Math.min(1, d / T.reelEasyTo)) * cfg.reel;

  s.fullReelMps = reelRate;
  while (s.accMs >= T.stepMs) {
    s.accMs -= T.stepMs;
    s.elapsedMs += T.stepMs;

    // ---- The surge cycle.
    s.phaseT -= h;
    if (s.phaseT <= 0) {
      if (s.phase === 'calm') {
        startSurge(s, fish, cfg, gear, rng);
      } else if (s.phase === 'warn') {
        if (s.feint) {
          s.phase = 'hush';
          s.phaseT = s.phaseTotal = SIGNATURE_TUNING.feintHushS;
        } else {
          beginRun(s);
        }
      } else if (s.phase === 'hush') {
        beginRun(s);
      } else if (s.chain > 0) {
        s.chain--;
        s.phase = 'warn';
        s.phaseT = s.phaseTotal = SIGNATURE_TUNING.flashWarnS;
        s.strength = Math.max(0.6, s.strength * 0.9);
        s.runDir = -s.runDir;
        s.runT = Math.max(0.5, s.runT * 0.7);
      } else {
        s.phase = 'calm';
        s.phaseT = s.phaseTotal = calmGap(cfg, d, gear, rng, fish.pattern === 'erratic');
      }
    }
    const surge = surgeLevel(s);

    // ---- Sideways: cuts, drift, and the run's own direction.
    if (s.cutWarn > 0) {
      s.cutWarn -= h;
      if (s.cutWarn <= 0) {
        s.cutWarn = 0;
        s.lateralTarget = s.cutTarget;
        // A cut jerks the line: at once, and hard if it is taut (a loose line can not be jerked).
      s.kickLeft += (cfg.cutKick[0] + (cfg.cutKick[1] - cfg.cutKick[0]) * Math.pow(d, T.kickCurve)) * (s.tension < T.kickFrom ? 0 : holding ? 1 : T.kickReleased);
      }
    } else {
      s.cutTimer -= h;
      if (s.cutTimer <= 0 && s.phase === 'calm') {
        const reach = lerp(cfg.cutReach, d);
        s.cutTarget = clamp(s.lateral + (rng() < 0.5 ? -1 : 1) * randRange(rng, 0.4, 1) * reach * 1.4, -1, 1);
        s.cutWarn = T.cutWarnS;
        s.cutTimer = lerp(cfg.cutEvery, d) * randRange(rng, 0.7, 1.3);
      }
    }
    if (s.phase === 'run') s.lateralTarget = clamp(s.runDir * (0.5 + 0.5 * s.strength), -1, 1);
    const swim = cfg.cutSpeed * (s.phase === 'run' ? 1.5 : 1) * h;
    s.lateral = clamp(s.lateral + clamp(s.lateralTarget - s.lateral, -swim, swim), -1, 1);

    // ---- Pull and tension.
    const wobble = 1 + 0.15 * Math.sin(s.elapsedMs / 1000 * 1.3 + s.wobble);
    const base = s.phase === 'hush' ? 0.02 : lerp(cfg.pull, d) * wobble;
    const pull = base + surge;
    const tensionBefore = s.tension;
    if (holding) {
      // Feathering: the tension climbs steadily while the thumb is down, the faster the heavier the fish and the pull.
      s.tension = s.tension + (cfg.rise[0] + (cfg.rise[1] - cfg.rise[0]) * Math.pow(d, T.riseCurve) + T.risePull * pull) * (1 + T.surgeRise * surge) * h;
    } else {
      const target = T.release + T.releaseGain * base + (T.surgeHold[0] + (T.surgeHold[1] - T.surgeHold[0]) * Math.pow(d, T.surgeHoldCurve)) * cfg.holdMul * surge;
      s.tension = s.tension > target ? Math.max(target, s.tension - lerp(cfg.fall, d) * h) : s.tension + (target - s.tension) * Math.min(1, T.releaseLag * h);
    }
    // Nothing but a telegraphed cut may lift the needle fast: the climb is capped at a third of the gold's width per 100 ms (a little more in a surge).
    s.tension = Math.min(s.tension, tensionBefore + (s.goldHi - s.goldLo) * T.riseCapPerS * (1 + T.riseCapSurge * surge) * h);
    // A cut's jerk is not instant: it is spread over `kickS` so the needle climbs where the player can see it and let go.
    if (s.kickLeft > 0) {
      const part = Math.min(s.kickLeft, (T.kickTotalRef / T.kickS) * h);
      s.kickLeft -= part;
      s.tension += part;
    }
    s.tension = clamp(s.tension, 0, 1);

    // ---- Reeling: only the gold reels at full speed, the red not at all; the reel is slower against a surge, and a surging fish takes line.
    // A long fight speeds the reel up a little (the fish tires): + reelTire x how far past `reelTireFromS` it is, over `reelTireOverS`.
    const tireUp = 1 + T.reelTire * clamp((s.elapsedMs / 1000 - T.reelTireFromS) / T.reelTireOverS, 0, 1);
    if (holding) s.distanceM -= reelRate * tireUp * reelFactor(s, gear.snapLimit) * (1 - T.surgeBrake * surge) * h;
    s.distanceM += s.startM * T.surgeRun * surge * (holding ? 0.35 : 1) * h;
    s.distanceM = clamp(s.distanceM, 0, s.startM * T.maxFarFactor);

    // ---- Slack: the hook slips when it hangs slack too long.
    if (s.tension < T.slackFloor) {
      s.slackS += h;
      s.slackTotalMs += T.stepMs;
    } else if (holding && s.tension >= T.slackClear) {
      s.slackS = Math.max(0, s.slackS - T.slackRecovery * h);
    }

    // ---- The gold: the perfect catch counts the share of the time (after the first second) the needle is inside it.
    if (s.elapsedMs > T.perfectSkipMs) {
      s.timedMs += T.stepMs;
      if (s.tension >= s.goldLo && s.tension < s.goldHi) s.goldMs += T.stepMs;
    }

    // ---- Red: it builds past the limit and drains slower than it builds, so a short mistake is forgiven.
    if (s.tension >= gear.snapLimit) {
      s.redS += h;
      s.redTotalMs += T.stepMs;
    } else {
      s.redS = Math.max(0, s.redS - (s.tension >= s.goldLo ? T.redRecoveryGold : T.redRecovery) * h);
    }

    if (s.distanceM <= 0) {
      s.distanceM = 0;
      s.result = 'caught';
      break;
    }
    if (s.redS > flexS) {
      s.result = 'snapped';
      break;
    }
    // The thumb-up time in the calm between surges (a surge lifts the tension, so only the quiet counts); any holding starts it over.
    s.releasedS = holding ? 0 : s.releasedS + (s.phase === 'run' ? T.releasedRunShare : s.phase === 'warn' ? 0.6 : 1) * (s.tension < s.goldLo ? 1 : 0.3) * h;
    if (s.slackS > slackLimit || s.releasedS > T.releasedSlipS) {
      s.result = 'slipped';
      break;
    }
    if (s.elapsedMs > T.maxFightMs) {
      s.result = 'escaped';
      break;
    }
  }
  return s;
}

function beginRun(s: LineFightState): void {
  s.phase = 'run';
  s.phaseT = s.phaseTotal = s.runT;
}

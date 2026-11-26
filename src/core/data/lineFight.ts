import type { FishPattern } from '../catchBar';

/**
 * Tunables of the "feel the line" fight (slice 28, core/lineFight.ts). Everything is data so it can be tuned with the bot sim
 * (src/sim/lineFight.sim.test.ts, docs/ECONOMY_SIM.md "Line fight"). Times are seconds, tension is 0..1.
 * A `Range` is [easy fish, hardest fish], blended by the fish's difficulty (raised to `difficultyCurve`).
 */
export type Range = [number, number];

export interface LinePattern {
  /** The fish's own steady pull on the line (0..1) while it is not surging. */
  pull: Range;
  /** Seconds of calm between the end of a surge and the next telegraph (randomised 0.7x..1.3x). */
  every: Range;
  /** How hard a surge pulls (0..1, added on top of the base pull). */
  strength: Range;
  /** How long a surge lasts. */
  run: Range;
  /** The telegraph: seconds between the splash and the pull. */
  warn: Range;
  /** Seconds between sideways cuts. */
  cutEvery: Range;
  /** How far a cut goes (0..1 of the lateral range). */
  cutReach: Range;
  /** How fast the fish swims sideways (lateral units per second). */
  cutSpeed: number;
  /** A sideways cut jerks the tension up by this much at once (see `kickFrom`, `kickReleased`). */
  cutKick: Range;
  /** How fast tension climbs and falls (1/s); a harder fish climbs faster, so the thumb must come off sooner. */
  rise: Range;
  fall: Range;
  /** Multiplies the reel speed against this fish. */
  reel: number;
  /** Spread of surge strength (0 = always the same, 0.4 = erratic). */
  strengthSpread: number;
}

export const LINE_FIGHT_TUNING = {
  /** Fixed physics step (ms). */
  stepMs: 1000 / 120,
  startTension: 0.35,
  /** Tension below this counts as slack. */
  slackFloor: 0.12,
  /** The steady (gold) band, drawn on the gauge. */
  goldBand: [0.34, 0.66] as [number, number],
  /** Tension target while the thumb is down: hold + holdGain * pull. */
  hold: 0.45,
  holdGain: 1.6,
  /** Tension target while released: release + releaseGain * pull. */
  release: 0.02,
  releaseGain: 0.35,
  /** Slack for longer than this in one go and the hook slips (seconds). Trophies: `trophySlackS`. */
  slackS: 2.0,
  trophySlackS: 1.3,
  /** Slack time drains at this share of the rate it builds while the line is taut, so a player who lets go most of the time still loses it, but a short slack is forgiven. */
  slackRecovery: 0.5,
  /** ...and only once the tension is back above this (a jerk of a cut that lifts it just over the floor does not count). */
  slackClear: 0.22,
  /** Share of the rod's flex budget a trophy has (it snaps the line sooner). */
  trophyFlex: 1.1,
  /** Red time drains at this share of the rate it builds, so short mistakes are forgiven. */
  redRecovery: 0.03,
  /** The line's snap limit (tension) is `snapBase + snapPerDrain * (1 - lineDrain)`: bamboo + plain line 0.76, braided 0.81, fluoro 0.86. */
  snapBase: 0.76,
  snapPerDrain: 0.35,
  /** The rod's flex budget in seconds in the red before the line snaps: `flexBase + flexPerZone * (zoneSize - 0.3)`: bamboo 0.95, fiberglass 1.35, carbon 1.75. */
  flexBase: 0.95,
  flexPerZone: 10,
  /** Reel speed, as a share of the starting distance per second: `reelBase * reelResponse * (1 - reelHeavy * difficulty) * pattern.reel`. */
  reelBase: 0.5,
  reelHeavy: 0.3,
  /** Against a surge the reel keeps only `1 - surgeBrake * strength` of its speed. */
  surgeBrake: 0.85,
  /** A surge takes line: share of the starting distance per second at full strength. */
  surgeRun: 0.035,
  /** The fish never gets farther than this times the starting distance. */
  maxFarFactor: 1.3,
  /** A surge makes the tension climb faster: the rise rate is x(1 + this * surge). */
  surgeRise: 1.5,
  /** Surge strength ramps in over this long, and out over it. */
  surgeRamp: 0.18,
  /** Bait calm (0..1 on the gear) shrinks surge strength by `calmStrength * calm` and stretches the calm gaps by 1 / (1 - calmGap * calm). */
  calmStrength: 0.3,
  calmGap: 0.5,
  /** A perfect catch: at most this long in total in the red, and this long in total slack (ms). */
  perfectRedGraceMs: 40,
  perfectSlackGraceMs: 500,
  /** Fights over this long end with the fish slipping (a safety net against a never-ending fight). */
  maxFightMs: 120_000,
  /** The first surge comes this soon. */
  firstSurgeS: 1.6,
  /** Difficulty is raised to this power before it blends the ranges. */
  difficultyCurve: 0.75,
  /** A cut's jerk is not felt at all below this tension (a loose line can not be jerked); with the thumb up it is only this share of it. */
  kickFrom: 0.2,
  kickReleased: 0.25,
  /** The cut's jerk blends with the difficulty to this power (steeper than the other ranges: the hard darters really yank). */
  kickCurve: 2.5,
  /** The lateral wobble of the fish between cuts (lateral units). */
  lateralDrift: 0.08,
  patterns: {
    // Long steady pulls: a surge you can ride, gentle at first.
    smooth: { pull: [0.1, 0.4], every: [3.4, 1.4], strength: [0.35, 0.8], run: [2.0, 3.4], warn: [0.75, 0.08], cutEvery: [3.2, 2.2], cutReach: [0.3, 0.6], cutSpeed: 0.7, cutKick: [0, 0.8], rise: [1.5, 5.5], fall: [1.8, 2.6], reel: 1, strengthSpread: 0.1 },
    // Quick sideways cuts that jerk the line, and short sharp surges.
    darting: { pull: [0.12, 0.36], every: [2.2, 0.9], strength: [0.4, 1], run: [0.7, 1.3], warn: [0.6, 0.1], cutEvery: [1.5, 0.7], cutReach: [0.5, 1], cutSpeed: 3.2, cutKick: [0.42, 1.2], rise: [2, 4], fall: [2.2, 2.8], reel: 1, strengthSpread: 0.15 },
    // Heavy and deep: a high steady pull and slow tension, so reel in short patient pulls.
    sinker: { pull: [0.26, 0.5], every: [3.8, 1.8], strength: [0.45, 0.9], run: [1.8, 3.2], warn: [0.85, 0.1], cutEvery: [4.5, 3.5], cutReach: [0.15, 0.3], cutSpeed: 0.5, cutKick: [0, 0.5], rise: [1.4, 2.55], fall: [1.4, 2], reel: 0.95, strengthSpread: 0.1 },
    // Surges out of nowhere, uneven in length and weight.
    erratic: { pull: [0.1, 0.34], every: [1.7, 0.7], strength: [0.35, 0.85], run: [0.5, 1.5], warn: [0.5, 0.08], cutEvery: [1.2, 0.6], cutReach: [0.4, 0.9], cutSpeed: 2.2, cutKick: [0.03, 0.6], rise: [2, 4], fall: [2.2, 2.8], reel: 1, strengthSpread: 0.35 },
    // A rudd: mild, mostly at the surface.
    floater: { pull: [0.08, 0.28], every: [3.8, 2.4], strength: [0.3, 0.6], run: [1.0, 1.8], warn: [0.75, 0.5], cutEvery: [2.2, 1.4], cutReach: [0.4, 0.8], cutSpeed: 1.4, cutKick: [0.02, 0.06], rise: [1.6, 2.4], fall: [2, 2.4], reel: 1, strengthSpread: 0.1 },
    // The legend: a calm drift, then a sudden heavy dive.
    abyssal: { pull: [0.21, 0.29], every: [5, 3.5], strength: [0.9, 1], run: [2.6, 3.4], warn: [0.6, 0.15], cutEvery: [4, 3], cutReach: [0.3, 0.5], cutSpeed: 0.8, cutKick: [0, 0.9], rise: [1.6, 6], fall: [1.6, 2.4], reel: 0.8, strengthSpread: 0 },
  } satisfies Record<FishPattern, LinePattern>,
};

/**
 * Each trophy has one signature move on top of its pattern (core/lineFight.ts):
 * `flash` = two quick strong surges back to back; `feint` = the splash, then the fish goes limp (the line sags), then it bolts;
 * `dive` = a very long, very heavy pull with a long warning.
 */
export type SignatureMove = 'flash' | 'feint' | 'dive';
export const SIGNATURE_MOVES: Record<string, SignatureMove> = {
  goldenTench: 'flash',
  silverGhost: 'feint',
  mossback: 'dive',
};

export const SIGNATURE_TUNING = {
  /** The signature move replaces a normal surge one time in this many. */
  oneIn: 3,
  /** The second surge of a flash comes after this short warning. */
  flashWarnS: 0.22,
  /** How long a feint goes limp before the pull. */
  feintHushS: 0.75,
  /** A dive: strength, run time and warning. */
  diveStrength: 0.9,
  diveRunS: 2.6,
  diveWarnS: 0.9,
};

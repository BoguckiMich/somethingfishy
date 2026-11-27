/**
 * The river's current (slice 25c, RIVER_BEND.md section 4), pure. A cast keeps its band, species and rare checks from the landing
 * distance; what the current changes is that the bobber DRIFTS toward the slack eddy while it waits (horizontal only), and that the bite
 * countdown runs faster in the seam while it passes and slower once it sits in the eddy. Nothing is re-rolled mid-wait.
 *
 * `drift` is the progress of the run, 0 (landed) to 1 (settled in the eddy). It advances linearly in time; `driftPos` turns it into the
 * eased position (constant speed, then it slows and stops exactly at the end), which the scene draws.
 */

export interface RiverCurrent {
  /** Seconds the bobber takes to reach the eddy at flow 1 (normal weather). */
  runS: number;
  /** The band whose bites come sooner while the bobber passes through it ('seam'). */
  seamBandId: string;
  /** Bite countdown speed while the bobber still drifts in the seam band (above 1: bites come sooner). */
  seamBiteMul: number;
  /** Bite countdown speed once the bobber has settled in the eddy, in any band (below 1: rarer bites). */
  eddyBiteMul: number;
  /** The fight's calm gaps are scaled by this (below 1: surges come more often), line style only. */
  fightEveryMul: number;
  /** An extra scale on the calm gaps while it rains. */
  rainFightEveryMul: number;
}

/** Where the drift starts to slow, as a share of the run. */
export const EASE_FROM = 0.7;

/** The river's numbers (data/locations.ts points the River bend at this). */
export const RIVER_CURRENT: RiverCurrent = {
  runS: 30,
  seamBandId: 'seam',
  seamBiteMul: 1.35,
  eddyBiteMul: 0.4,
  fightEveryMul: 0.85,
  rainFightEveryMul: 0.85,
};

/** The run advances by `dtMs / runS * flow` (flow 1 = normal weather, more in rain, less while the ferry slows the water); it never goes past 1. */
export function advanceDrift(drift: number, dtMs: number, flow: number, cur: RiverCurrent): number {
  return Math.min(1, drift + (dtMs / 1000 / cur.runS) * Math.max(0, flow));
}

/** The eased position of the bobber along its run, 0..1: steady for the first `EASE_FROM`, then a smooth stop (zero speed) exactly at 1. */
export function driftPos(drift: number): number {
  const t = Math.min(1, Math.max(0, drift));
  const v = 2 / (1 + EASE_FROM);
  if (t <= EASE_FROM) return v * t;
  const u = t - EASE_FROM;
  return v * (EASE_FROM + u - u * u / (2 * (1 - EASE_FROM)));
}

/** How fast the bite countdown runs (1 = as at the lake): faster in the seam while the bobber drifts, slower once it sits in the eddy. */
export function biteRate(cur: RiverCurrent | undefined, bandId: string, drift: number | undefined): number {
  if (!cur || drift === undefined) return 1;
  if (drift >= 1) return cur.eddyBiteMul;
  return bandId === cur.seamBandId ? cur.seamBiteMul : 1;
}

/**
 * The fight's calm-gap scale (line style): 1 away from the river, else the river's, with the rain's on top. The trophies and the legendary
 * (`trophy`: a hook that can slip) keep their own tuning: their per-species balance (data/lineFight.ts) cannot absorb more surges (the sim in
 * ECONOMY_SIM "River current" shows the Ferry pike falling 46 points in the rain), so the current's rhythm is for the ordinary river fish.
 */
export function fightEveryMul(cur: RiverCurrent | undefined, raining: boolean, trophy = false): number {
  if (!cur || trophy) return 1;
  return cur.fightEveryMul * (raining ? cur.rainFightEveryMul : 1);
}

import { PALE_ONE } from './data/legendary';
import { speciesById, type Species } from './data/fish';
import type { Rng } from './random';

/**
 * Rules for the legendary "Pale One" (pure). It is not in the weighted spawn pool: a landed cast
 * far enough out, inside the clock window, replaces the normal pick with a fixed chance.
 */

const MINUTES_PER_DAY = 24 * 60;

/** Is the clock inside the Pale One's window (02:00 to 04:00)? Any minute works; it wraps around the day. */
export function inPaleWindow(minute: number): boolean {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return m >= PALE_ONE.fromHour * 60 && m < PALE_ONE.toHour * 60;
}

/** Can the Pale One bite for a bobber that landed at `distanceM` when the clock shows `minute`? */
export function paleCanSpawn(distanceM: number, minute: number): boolean {
  return distanceM >= PALE_ONE.minDistanceM && inPaleWindow(minute);
}

/**
 * Rolls the replacement for a landed cast: the Pale One with its chance when the conditions hold,
 * otherwise undefined. The rng is only drawn when the conditions hold, so every other cast rolls
 * exactly as before.
 */
export function rollLegendary(distanceM: number, minute: number, rng: Rng): Species | undefined {
  if (!paleCanSpawn(distanceM, minute)) return undefined;
  return rng() < PALE_ONE.chance ? speciesById(PALE_ONE.speciesId) : undefined;
}

/** Legendaries are trophies: after the show-off they slip away (no bag slot, no coins). */
export function slipsAway(speciesId: string): boolean {
  return speciesById(speciesId)?.rarity === 'legendary';
}

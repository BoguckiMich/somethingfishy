import { FERRYMAN, PALE_ONE } from './data/legendary';
import { LAKE_ID } from './data/rare';
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

/** Is the clock inside the Ferryman's window (the dusk, 18:00 to 20:00)? */
export function inFerrymanWindow(minute: number): boolean {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return m >= FERRYMAN.fromHour * 60 && m < FERRYMAN.toHour * 60;
}

/** Can the Ferryman bite for a bobber that landed in band `bandId` at `distanceM` when the clock shows `minute` (at the River bend)? */
export function ferrymanCanSpawn(placeId: string | undefined, bandId: string | undefined, distanceM: number, minute: number): boolean {
  return placeId === FERRYMAN.placeId && bandId === FERRYMAN.bandId && distanceM >= FERRYMAN.minDistanceM && inFerrymanWindow(minute);
}

/**
 * Rolls the replacement for a landed cast: the place's legendary (the Pale One at Quiet Lake, the Ferryman at the River bend) with its chance
 * when the conditions hold, otherwise undefined. The rng is only drawn when the conditions hold, so every other cast rolls exactly as before.
 * A cast with no place is Quiet Lake's.
 */
export function rollLegendary(distanceM: number, minute: number, rng: Rng, placeId: string = LAKE_ID, bandId?: string): Species | undefined {
  if (placeId === LAKE_ID) return paleCanSpawn(distanceM, minute) && rng() < PALE_ONE.chance ? speciesById(PALE_ONE.speciesId) : undefined;
  return ferrymanCanSpawn(placeId, bandId, distanceM, minute) && rng() < FERRYMAN.chance ? speciesById(FERRYMAN.speciesId) : undefined;
}

/** Legendaries are trophies: after the show-off they slip away (no bag slot, no coins). */
export function slipsAway(speciesId: string): boolean {
  return speciesById(speciesId)?.rarity === 'legendary';
}

import type { FishProfile } from './catchBar';
import type { TimeOfDay } from './clock';
import { baitById } from './data/baits';
import { FOTD_TUNING } from './data/fotd';
import { POOL_SPECIES, speciesById, type Rarity, type Species } from './data/fish';
import { weatherAllowsAnyTime, weatherWeightMult, type WeatherEffects } from './daily/weather';
import { rollLegendary } from './legendary';
import { RARE_TUNING } from './data/rare';
import { rollRare } from './rare';
import type { ZoneId } from './location';
import type { Rng } from './random';

/** A fish on the line: rolled once when the bobber lands, then carried through the fight to the catch. */
export interface HookedFish {
  speciesId: string;
  lengthCm: number;
  weightG: number;
}

/** Spawn weights by rarity. */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 30, rare: 10, legendary: 0, trophy: 0 };

export const FISH_TUNING = {
  /** Length roll: min + (max - min) * u^k. k > 1 skews toward small fish. */
  lengthSkew: 2,
  /** Species whose max length is at least this (cm), and not legendary, use `bigLengthSkew` instead: big fish stay big. */
  bigSpeciesCm: 80,
  bigLengthSkew: 1.5,
  /** Difficulty added at the very top of a species' size range. */
  sizeDifficulty: 0.1,
  /** Shallow fish never get harder than this, whatever their size. */
  shallowCap: 0.4,
};

/** The species that may bite here and now; some weathers (overcast) let the ones that like it bite at any time of day. */
export function candidates(zone: ZoneId, time: TimeOfDay, fx?: WeatherEffects): Species[] {
  return POOL_SPECIES.filter((s) => s.zone === zone && (s.times.includes(time) || weatherAllowsAnyTime(s, fx)));
}

/** The spawn weight of a species, with the bait's boost (slice 15c) on top; worms or none: the plain weight. */
export function spawnWeight(species: Species, baitId?: string, fotdId?: string, fx?: WeatherEffects): number {
  const bait = baitById(baitId);
  let w = RARITY_WEIGHT[species.rarity];
  if (bait?.speciesBoost?.ids.includes(species.id)) w *= bait.speciesBoost.factor;
  if (bait?.rarityBoost?.rarity === species.rarity) w *= bait.rarityBoost.factor;
  // Today's fish bites more (slice 19); it stacks with the bait.
  if (fotdId && species.id === fotdId) w *= FOTD_TUNING.weightMult;
  // Today's weather (slice 23b) reweights the same way.
  w *= weatherWeightMult(species, fx);
  return w;
}

/** Picks among the species zone + time allow; the bait and the fish of the day only reweight those, so they can never add a species. */
export function pickSpecies(zone: ZoneId, time: TimeOfDay, rng: Rng, baitId?: string, fotdId?: string, fx?: WeatherEffects): Species {
  const pool = candidates(zone, time, fx);
  const total = pool.reduce((sum, s) => sum + spawnWeight(s, baitId, fotdId, fx), 0);
  let roll = rng() * total;
  for (const s of pool) {
    roll -= spawnWeight(s, baitId, fotdId, fx);
    if (roll < 0) return s;
  }
  return pool[pool.length - 1];
}

/** The length-roll exponent: gentler for the big species (catfish, pike, carp, eel, zander). */
export function lengthSkewFor(species: Species): number {
  return species.rarity !== 'legendary' && species.lengthCm[1] >= FISH_TUNING.bigSpeciesCm ? FISH_TUNING.bigLengthSkew : FISH_TUNING.lengthSkew;
}

/** Whole centimetres within the species range, skewed small. */
export function rollLength(species: Species, rng: Rng): number {
  const [min, max] = species.lengthCm;
  return Math.round(min + (max - min) * Math.pow(rng(), lengthSkewFor(species)));
}

/** Weight in whole grams: a * L^3. */
export function weightG(species: Species, lengthCm: number): number {
  return Math.round(species.bodyFactor * lengthCm ** 3);
}

/** Where and when the bobber landed; the legendary rule needs it (the zone and time of day are not enough). */
export interface CastPlace {
  distanceM: number;
  /** Minute of the in-game day. */
  minute: number;
}

/** Picks the species (or the forced one) and rolls its size. A legendary or a trophy (slice 23d) may replace the normal pick. */
export function rollHookedFish(zone: ZoneId, time: TimeOfDay, rng: Rng, forcedId?: string, place?: CastPlace, baitId?: string, fotdId?: string, fx?: WeatherEffects): HookedFish {
  const species =
    (forcedId ? speciesById(forcedId) : undefined) ??
    (place ? rollLegendary(place.distanceM, place.minute, rng) : undefined) ??
    (place ? rollRare({ zone, distanceM: place.distanceM, minute: place.minute, weather: fx?.id, baitId }, rng) : undefined) ??
    pickSpecies(zone, time, rng, baitId, fotdId, fx);
  const lengthCm = rollLength(species, rng);
  return { speciesId: species.id, lengthCm, weightG: weightG(species, lengthCm) };
}

/** Where `lengthCm` sits in the species' range, 0..1. */
export function sizeShare(species: Species, lengthCm: number): number {
  const [min, max] = species.lengthCm;
  return Math.min(1, Math.max(0, (lengthCm - min) / (max - min)));
}

/** What the catch bar sees: the species' pattern, with difficulty raised a little for big fish. */
export function fightProfile(species: Species, lengthCm: number, difficultyAdd = 0): FishProfile {
  const raw = species.difficulty + FISH_TUNING.sizeDifficulty * sizeShare(species, lengthCm);
  // A trophy (slice 23d) is hard even in the shallows, and slips away when it stays out of the green zone too long.
  const trophy = species.rarity === 'trophy';
  const cap = species.zone === 'shallow' && !trophy ? FISH_TUNING.shallowCap : 1;
  // A windy day (slice 23b) makes every fight a little harder, past the shallow cap but never above 1.
  const profile: FishProfile = { pattern: species.pattern, difficulty: Math.min(1, Math.min(cap, raw) + difficultyAdd) };
  return trophy ? { ...profile, slipAfterMs: RARE_TUNING.slipAfterMs } : profile;
}

/** "24 cm · 210 g", or "50 cm · 1.8 kg" from 1000 g up. */
export function formatCatchSize(lengthCm: number, weight: number): string {
  const w = weight >= 1000 ? `${(weight / 1000).toFixed(1)} kg` : `${weight} g`;
  return `${lengthCm} cm · ${w}`;
}

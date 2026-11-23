import type { FishProfile } from './catchBar';
import type { TimeOfDay } from './clock';
import { baitById } from './data/baits';
import { POOL_SPECIES, speciesById, type Rarity, type Species } from './data/fish';
import { rollLegendary } from './legendary';
import type { ZoneId } from './location';
import type { Rng } from './random';

/** A fish on the line: rolled once when the bobber lands, then carried through the fight to the catch. */
export interface HookedFish {
  speciesId: string;
  lengthCm: number;
  weightG: number;
}

/** Spawn weights by rarity. */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 30, rare: 10, legendary: 0 };

export const FISH_TUNING = {
  /** Length roll: min + (max - min) * u^k. k > 1 skews toward small fish. */
  lengthSkew: 2,
  /** Difficulty added at the very top of a species' size range. */
  sizeDifficulty: 0.1,
  /** Shallow fish never get harder than this, whatever their size. */
  shallowCap: 0.3,
};

export function candidates(zone: ZoneId, time: TimeOfDay): Species[] {
  return POOL_SPECIES.filter((s) => s.zone === zone && s.times.includes(time));
}

/** The spawn weight of a species, with the bait's boost (slice 15c) on top; worms or none: the plain weight. */
export function spawnWeight(species: Species, baitId?: string): number {
  const bait = baitById(baitId);
  let w = RARITY_WEIGHT[species.rarity];
  if (bait?.speciesBoost?.ids.includes(species.id)) w *= bait.speciesBoost.factor;
  if (bait?.rarityBoost?.rarity === species.rarity) w *= bait.rarityBoost.factor;
  return w;
}

/** Picks among the species zone + time allow; the bait only reweights those, so it can never add a species. */
export function pickSpecies(zone: ZoneId, time: TimeOfDay, rng: Rng, baitId?: string): Species {
  const pool = candidates(zone, time);
  const total = pool.reduce((sum, s) => sum + spawnWeight(s, baitId), 0);
  let roll = rng() * total;
  for (const s of pool) {
    roll -= spawnWeight(s, baitId);
    if (roll < 0) return s;
  }
  return pool[pool.length - 1];
}

/** Whole centimetres within the species range, skewed small. */
export function rollLength(species: Species, rng: Rng): number {
  const [min, max] = species.lengthCm;
  return Math.round(min + (max - min) * Math.pow(rng(), FISH_TUNING.lengthSkew));
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

/** Picks the species (or the forced one) and rolls its size. A legendary may replace the normal pick. */
export function rollHookedFish(zone: ZoneId, time: TimeOfDay, rng: Rng, forcedId?: string, place?: CastPlace, baitId?: string): HookedFish {
  const species =
    (forcedId ? speciesById(forcedId) : undefined) ??
    (place ? rollLegendary(place.distanceM, place.minute, rng) : undefined) ??
    pickSpecies(zone, time, rng, baitId);
  const lengthCm = rollLength(species, rng);
  return { speciesId: species.id, lengthCm, weightG: weightG(species, lengthCm) };
}

/** Where `lengthCm` sits in the species' range, 0..1. */
export function sizeShare(species: Species, lengthCm: number): number {
  const [min, max] = species.lengthCm;
  return Math.min(1, Math.max(0, (lengthCm - min) / (max - min)));
}

/** What the catch bar sees: the species' pattern, with difficulty raised a little for big fish. */
export function fightProfile(species: Species, lengthCm: number): FishProfile {
  const raw = species.difficulty + FISH_TUNING.sizeDifficulty * sizeShare(species, lengthCm);
  const cap = species.zone === 'shallow' ? FISH_TUNING.shallowCap : 1;
  return { pattern: species.pattern, difficulty: Math.min(cap, raw) };
}

/** "24 cm · 210 g", or "50 cm · 1.8 kg" from 1000 g up. */
export function formatCatchSize(lengthCm: number, weight: number): string {
  const w = weight >= 1000 ? `${(weight / 1000).toFixed(1)} kg` : `${weight} g`;
  return `${lengthCm} cm · ${w}`;
}

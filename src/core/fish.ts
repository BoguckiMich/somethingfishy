import type { FishProfile } from './catchBar';
import type { TimeOfDay } from './clock';
import { SPECIES, speciesById, type Rarity, type Species } from './data/fish';
import type { ZoneId } from './location';
import type { Rng } from './random';

/** A fish on the line: rolled once when the bobber lands, then carried through the fight to the catch. */
export interface HookedFish {
  speciesId: string;
  lengthCm: number;
  weightG: number;
}

/** Spawn weights by rarity. */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 30, rare: 10 };

export const FISH_TUNING = {
  /** Length roll: min + (max - min) * u^k. k > 1 skews toward small fish. */
  lengthSkew: 2,
  /** Difficulty added at the very top of a species' size range. */
  sizeDifficulty: 0.1,
  /** Shallow fish never get harder than this, whatever their size. */
  shallowCap: 0.3,
};

export function candidates(zone: ZoneId, time: TimeOfDay): Species[] {
  return SPECIES.filter((s) => s.zone === zone && s.times.includes(time));
}

export function pickSpecies(zone: ZoneId, time: TimeOfDay, rng: Rng): Species {
  const pool = candidates(zone, time);
  const total = pool.reduce((sum, s) => sum + RARITY_WEIGHT[s.rarity], 0);
  let roll = rng() * total;
  for (const s of pool) {
    roll -= RARITY_WEIGHT[s.rarity];
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

/** Picks the species (or the forced one) and rolls its size. */
export function rollHookedFish(zone: ZoneId, time: TimeOfDay, rng: Rng, forcedId?: string): HookedFish {
  const species = (forcedId ? speciesById(forcedId) : undefined) ?? pickSpecies(zone, time, rng);
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

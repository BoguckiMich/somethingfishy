import { isTrophy, isUnique, speciesById, type Species } from './fish';
import { sizeShare } from '../fish';

/** Size stars (slice 19): none, or bronze / silver / gold by where the length sits in the species range. */
export type Star = 'none' | 'bronze' | 'silver' | 'gold';

/** A catch's tier (slice 23f): a star, or a medal, the tier above gold that only a perfect catch of a gold-size fish earns. */
export type Tier = Star | 'medal';

/** `sizeShare` (0 smallest .. 1 biggest) from which each star is earned. Tunable data. */
export const STAR_THRESHOLDS = { bronze: 0.25, silver: 0.5, gold: 0.8 } as const;

/** How many little stars each tier shows (a medal shows its own picture, not stars). */
export const STAR_COUNT: Record<Star, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };

/** Tier order, for comparing: a medal counts as gold wherever a checklist star slot asks for one (gold is the highest slot minimum). */
export const TIER_RANK: Record<Tier, number> = { none: 0, bronze: 1, silver: 2, gold: 3, medal: 4 };

/** The star a length earns in a species' size range (ignores that the legendary and trophies show none). */
export function sizeStar(species: Species, lengthCm: number): Star {
  const share = sizeShare(species, lengthCm);
  if (share >= STAR_THRESHOLDS.gold) return 'gold';
  if (share >= STAR_THRESHOLDS.silver) return 'silver';
  if (share >= STAR_THRESHOLDS.bronze) return 'bronze';
  return 'none';
}

/** The star of a fish; the legendary and the trophy fish have none. */
export function starFor(species: Species, lengthCm: number): Star {
  return isUnique(species) ? 'none' : sizeStar(species, lengthCm);
}

const NEXT_STAR: Record<Star, Tier> = { none: 'bronze', bronze: 'silver', silver: 'gold', gold: 'medal' };

/**
 * The tier of a catch (slice 23f). A perfect catch (the fish never left the green zone) is worth +1 tier:
 * none -> bronze -> silver -> gold. A medal is only for a gold-size fish caught perfectly. The legendary has no
 * tier; a trophy fish has none either, except the medal for a perfect catch of a gold-size one.
 */
export function tierFor(species: Species, lengthCm: number, perfect: boolean): Tier {
  if (species.rarity === 'legendary') return 'none';
  if (isTrophy(species)) return perfect && sizeStar(species, lengthCm) === 'gold' ? 'medal' : 'none';
  const star = sizeStar(species, lengthCm);
  return perfect ? NEXT_STAR[star] : star;
}

/** The tier of a fish in the bag (`perfect` is stored on the fish when it was caught perfectly). */
export function bagTier(fish: { speciesId: string; lengthCm: number; perfect?: boolean }): Tier {
  const sp = speciesById(fish.speciesId);
  return sp ? tierFor(sp, fish.lengthCm, fish.perfect === true) : 'none';
}

/** Gold or better: what the checklist's gold warning, the gold badge and the gold count care about. */
export const isGoldOrBetter = (t: Tier): boolean => TIER_RANK[t] >= TIER_RANK.gold;

export const isTier = (v: unknown): v is Tier => typeof v === 'string' && v in TIER_RANK;

/** A length inside the star's band (for the dev flag): the middle of the band. */
export function lengthForStar(species: Species, star: Star): number {
  const [min, max] = species.lengthCm;
  const lo = star === 'none' ? 0 : STAR_THRESHOLDS[star];
  const hi = star === 'gold' ? 1 : star === 'silver' ? STAR_THRESHOLDS.gold : star === 'bronze' ? STAR_THRESHOLDS.silver : STAR_THRESHOLDS.bronze;
  const target = Math.round(min + (max - min) * (lo + hi) / 2);
  return starFor(species, target) === star ? target : Math.round(min + (max - min) * lo + 1);
}

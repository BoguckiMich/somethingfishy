import { isLegendary, type Species } from './fish';
import { sizeShare } from '../fish';

/** Size stars (slice 19): none, or bronze / silver / gold by where the length sits in the species range. */
export type Star = 'none' | 'bronze' | 'silver' | 'gold';

/** `sizeShare` (0 smallest .. 1 biggest) from which each star is earned. Tunable data. */
export const STAR_THRESHOLDS = { bronze: 0.25, silver: 0.5, gold: 0.8 } as const;

/** How many little stars each tier shows. */
export const STAR_COUNT: Record<Star, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };

/** The star of a fish; the legendary has none. */
export function starFor(species: Species, lengthCm: number): Star {
  if (isLegendary(species)) return 'none';
  const share = sizeShare(species, lengthCm);
  if (share >= STAR_THRESHOLDS.gold) return 'gold';
  if (share >= STAR_THRESHOLDS.silver) return 'silver';
  if (share >= STAR_THRESHOLDS.bronze) return 'bronze';
  return 'none';
}

/** A length inside the star's band (for the dev flag): the middle of the band. */
export function lengthForStar(species: Species, star: Star): number {
  const [min, max] = species.lengthCm;
  const lo = star === 'none' ? 0 : STAR_THRESHOLDS[star];
  const hi = star === 'gold' ? 1 : star === 'silver' ? STAR_THRESHOLDS.gold : star === 'bronze' ? STAR_THRESHOLDS.silver : STAR_THRESHOLDS.bronze;
  const target = Math.round(min + (max - min) * (lo + hi) / 2);
  return starFor(species, target) === star ? target : Math.round(min + (max - min) * lo + 1);
}

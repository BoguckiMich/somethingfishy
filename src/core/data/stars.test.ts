import { describe, expect, it } from 'vitest';
import { POOL_SPECIES, SPECIES, isLegendary, speciesById } from './fish';
import { rollLength } from '../fish';
import { GOLD_LINES } from './pajkelLines';
import { seededRng } from '../random';
import { STAR_COUNT, STAR_THRESHOLDS, lengthForStar, starFor, type Star } from './stars';

const perch = speciesById('perch')!; // 10..35 cm

describe('starFor', () => {
  it('follows the thresholds at the edges', () => {
    const at = (share: number) => perch.lengthCm[0] + (perch.lengthCm[1] - perch.lengthCm[0]) * share;
    expect(starFor(perch, 10)).toBe('none');
    expect(starFor(perch, at(STAR_THRESHOLDS.bronze) - 0.01)).toBe('none');
    expect(starFor(perch, at(STAR_THRESHOLDS.bronze))).toBe('bronze');
    expect(starFor(perch, at(STAR_THRESHOLDS.silver))).toBe('silver');
    expect(starFor(perch, at(STAR_THRESHOLDS.gold))).toBe('gold');
    expect(starFor(perch, 35)).toBe('gold');
  });
  it('has no stars for the legendary, whatever its length', () => {
    const legend = SPECIES.find(isLegendary)!;
    expect(starFor(legend, legend.lengthCm[1])).toBe('none');
    expect(starFor(legend, legend.lengthCm[0])).toBe('none');
  });
  it('counts 0..3 stars', () => {
    expect(Object.values(STAR_COUNT)).toEqual([0, 1, 2, 3]);
  });
  it('rolled lengths come out around 45 / 22 / 20 / 12.5 % (big species use the gentler skew)', () => {
    const rng = seededRng(7);
    const n = 40000;
    const seen: Record<Star, number> = { none: 0, bronze: 0, silver: 0, gold: 0 };
    for (let i = 0; i < n; i++) {
      const sp = POOL_SPECIES[i % POOL_SPECIES.length];
      seen[starFor(sp, rollLength(sp, rng))]++;
    }
    expect(seen.none / n).toBeGreaterThan(0.42);
    expect(seen.none / n).toBeLessThan(0.58);
    expect(seen.bronze / n).toBeGreaterThan(0.15);
    expect(seen.bronze / n).toBeLessThan(0.27);
    expect(seen.silver / n).toBeGreaterThan(0.12);
    expect(seen.silver / n).toBeLessThan(0.24);
    expect(seen.gold / n).toBeGreaterThan(0.07);
    expect(seen.gold / n).toBeLessThan(0.16);
  });
});

describe('gold lines', () => {
  it('are short enough for one line of the speech bubble', () => {
    expect(GOLD_LINES.length).toBeGreaterThanOrEqual(2);
    for (const l of GOLD_LINES) expect(l.length).toBeLessThanOrEqual(30);
  });
});

describe('lengthForStar', () => {
  it('gives a length with the asked star for every species', () => {
    for (const sp of POOL_SPECIES) for (const star of ['none', 'bronze', 'silver', 'gold'] as const) expect(starFor(sp, lengthForStar(sp, star))).toBe(star);
  });
});

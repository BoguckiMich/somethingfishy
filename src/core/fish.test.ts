import { describe, expect, it } from 'vitest';
import type { TimeOfDay } from './clock';
import { SPECIES, speciesById } from './data/fish';
import { RARITY_WEIGHT, candidates, fightProfile, formatCatchSize, pickSpecies, rollHookedFish, rollLength, weightG } from './fish';
import type { ZoneId } from './location';
import { seededRng } from './random';

const ZONES: ZoneId[] = ['shallow', 'deep'];
const TIMES: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('roster data', () => {
  it('has the 12 species with unique ids and sane ranges', () => {
    expect(SPECIES).toHaveLength(12);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(12);
    for (const s of SPECIES) {
      expect(s.lengthCm[0]).toBeLessThan(s.lengthCm[1]);
      expect(s.nibbles[0]).toBeLessThanOrEqual(s.nibbles[1]);
      expect(s.times.length).toBeGreaterThan(0);
      expect(s.fact.length).toBeGreaterThan(20);
      expect(s.basePrice).toBeGreaterThan(0);
    }
  });

  it('typical weights are realistic (a * L^3)', () => {
    const w = (id: string, cm: number) => weightG(speciesById(id)!, cm);
    expect(w('roach', 30)).toBeGreaterThan(250);
    expect(w('roach', 30)).toBeLessThan(350);
    expect(w('perch', 25)).toBeGreaterThan(170);
    expect(w('perch', 25)).toBeLessThan(230);
    expect(w('eel', 60)).toBeGreaterThan(400);
    expect(w('eel', 60)).toBeLessThan(600);
    expect(w('bream', 50)).toBeGreaterThan(1500);
    expect(w('bream', 50)).toBeLessThan(2100);
    expect(w('carp', 70)).toBeGreaterThan(5000);
    expect(w('carp', 70)).toBeLessThan(7000);
    expect(w('pike', 100)).toBeGreaterThan(7000);
    expect(w('pike', 100)).toBeLessThan(9000);
    expect(w('catfish', 150)).toBeGreaterThan(22000);
    expect(w('catfish', 150)).toBeLessThan(28000);
  });

  it('prices rise with rarity and depth', () => {
    const cheapestDeep = Math.min(...SPECIES.filter((s) => s.zone === 'deep').map((s) => s.basePrice));
    const dearestShallow = Math.max(...SPECIES.filter((s) => s.zone === 'shallow').map((s) => s.basePrice));
    expect(cheapestDeep).toBeGreaterThanOrEqual(dearestShallow - 5);
    expect(speciesById('catfish')!.basePrice).toBe(Math.max(...SPECIES.map((s) => s.basePrice)));
  });
});

describe('spawn rules', () => {
  it('every zone x time of day has at least one candidate', () => {
    for (const z of ZONES) for (const t of TIMES) expect(candidates(z, t).length, `${z} ${t}`).toBeGreaterThan(0);
  });

  it('candidates match the zone and the time', () => {
    for (const s of candidates('deep', 'night')) {
      expect(s.zone).toBe('deep');
      expect(s.times).toContain('night');
    }
    expect(candidates('shallow', 'night').map((s) => s.id)).toContain('eel');
    expect(candidates('shallow', 'day').map((s) => s.id)).not.toContain('eel');
    expect(candidates('deep', 'dawn').map((s) => s.id)).toContain('tench');
    expect(candidates('deep', 'day').map((s) => s.id)).not.toContain('catfish');
  });

  it('weights are 60/30/10', () => {
    expect(RARITY_WEIGHT).toEqual({ common: 60, uncommon: 30, rare: 10 });
  });

  it('pickSpecies only returns candidates and favours common over rare', () => {
    const counts: Record<string, number> = {};
    const rng = seededRng(5);
    for (let i = 0; i < 4000; i++) {
      const s = pickSpecies('deep', 'night', rng);
      expect(candidates('deep', 'night')).toContain(s);
      counts[s.id] = (counts[s.id] ?? 0) + 1;
    }
    // night/deep: bream (common 60), carp (30), zander (30), catfish (rare 10): catfish is ~7%
    const share = (counts.catfish ?? 0) / 4000;
    expect(share).toBeGreaterThan(0.04);
    expect(share).toBeLessThan(0.11);
    expect(counts.bream).toBeGreaterThan(counts.carp);
  });

  it('is deterministic for a seed', () => {
    expect(pickSpecies('shallow', 'day', seededRng(9)).id).toBe(pickSpecies('shallow', 'day', seededRng(9)).id);
  });
});

describe('sizes', () => {
  const perch = speciesById('perch')!;
  it('rolls stay inside the range and skew small', () => {
    const rolls = seeds(2000).map((i) => rollLength(perch, seededRng(i * 13)));
    for (const l of rolls) {
      expect(l).toBeGreaterThanOrEqual(perch.lengthCm[0]);
      expect(l).toBeLessThanOrEqual(perch.lengthCm[1]);
    }
    const mid = (perch.lengthCm[0] + perch.lengthCm[1]) / 2;
    expect(rolls.filter((l) => l < mid).length / rolls.length).toBeGreaterThan(0.6);
    const top = perch.lengthCm[0] + (perch.lengthCm[1] - perch.lengthCm[0]) * 0.9;
    const topShare = rolls.filter((l) => l > top).length / rolls.length;
    expect(topShare).toBeGreaterThan(0);
    expect(topShare).toBeLessThan(0.1);
  });

  it('weight grows with the cube of length and is a whole number of grams', () => {
    expect(weightG(perch, 20)).toBeLessThan(weightG(perch, 30));
    expect(Number.isInteger(weightG(perch, 23))).toBe(true);
    expect(weightG(perch, 40) / weightG(perch, 20)).toBeGreaterThan(7.5);
  });

  it('rollHookedFish rolls species, length and weight together', () => {
    const f = rollHookedFish('deep', 'night', seededRng(3));
    const s = speciesById(f.speciesId)!;
    expect(f.lengthCm).toBeGreaterThanOrEqual(s.lengthCm[0]);
    expect(f.weightG).toBe(weightG(s, f.lengthCm));
  });

  it('rollHookedFish can be forced to a species', () => {
    const f = rollHookedFish('shallow', 'day', seededRng(3), 'catfish');
    expect(f.speciesId).toBe('catfish');
  });
});

describe('fightProfile', () => {
  it('adds up to +0.10 difficulty by size', () => {
    const carp = speciesById('carp')!;
    const small = fightProfile(carp, carp.lengthCm[0]);
    const big = fightProfile(carp, carp.lengthCm[1]);
    expect(small).toEqual({ pattern: carp.pattern, difficulty: carp.difficulty });
    expect(big.difficulty).toBeCloseTo(carp.difficulty + 0.1, 6);
    const mid = fightProfile(carp, (carp.lengthCm[0] + carp.lengthCm[1]) / 2);
    expect(mid.difficulty).toBeCloseTo(carp.difficulty + 0.05, 6);
  });

  it('caps shallow fish at 0.3 and everything at 1', () => {
    const eel = speciesById('eel')!;
    expect(fightProfile(eel, eel.lengthCm[1]).difficulty).toBe(0.3);
    for (const s of SPECIES) {
      const d = fightProfile(s, s.lengthCm[1]).difficulty;
      expect(d).toBeLessThanOrEqual(s.zone === 'shallow' ? 0.3 : 1);
    }
  });
});

describe('formatCatchSize', () => {
  it('shows cm and grams below a kilo', () => {
    expect(formatCatchSize(24, 210)).toBe('24 cm · 210 g');
    expect(formatCatchSize(30, 999)).toBe('30 cm · 999 g');
  });
  it('switches to kg with one decimal from 1000 g', () => {
    expect(formatCatchSize(50, 1800)).toBe('50 cm · 1.8 kg');
    expect(formatCatchSize(50, 1000)).toBe('50 cm · 1.0 kg');
    expect(formatCatchSize(150, 25340)).toBe('150 cm · 25.3 kg');
  });
});

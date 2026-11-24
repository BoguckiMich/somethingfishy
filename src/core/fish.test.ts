import { describe, expect, it } from 'vitest';
import type { TimeOfDay } from './clock';
import { POOL_SPECIES, SPECIES, speciesById } from './data/fish';
import { FISH_TUNING, RARITY_WEIGHT, candidates, fightProfile, formatCatchSize, lengthSkewFor, pickSpecies, rollHookedFish, rollLength, sizeShare, weightG } from './fish';
import type { ZoneId } from './location';
import { seededRng } from './random';

const ZONES: ZoneId[] = ['shallow', 'deep'];
const TIMES: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('roster data', () => {
  it('has the 15 pool species plus the legendary, unique ids and sane ranges', () => {
    expect(SPECIES).toHaveLength(16);
    expect(POOL_SPECIES).toHaveLength(15);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(16);
    expect(SPECIES.filter((s) => s.rarity === 'legendary').map((s) => s.id)).toEqual(['pale']);
    for (const s of SPECIES) {
      expect(s.lengthCm[0]).toBeLessThan(s.lengthCm[1]);
      expect(s.nibbles[0]).toBeLessThanOrEqual(s.nibbles[1]);
      expect(s.times.length).toBeGreaterThan(0);
      expect(s.fact.length).toBeGreaterThan(20);
      if (s.rarity !== 'legendary') expect(s.basePrice).toBeGreaterThan(0);
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
    const cheapestDeep = Math.min(...POOL_SPECIES.filter((s) => s.zone === 'deep').map((s) => s.basePrice));
    const dearestShallow = Math.max(...POOL_SPECIES.filter((s) => s.zone === 'shallow').map((s) => s.basePrice));
    expect(cheapestDeep).toBeGreaterThanOrEqual(dearestShallow - 5);
    expect(speciesById('catfish')!.basePrice).toBe(Math.max(...POOL_SPECIES.map((s) => s.basePrice)));
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

  it('the three newest species (slice 23c) bite in their own zone and time window', () => {
    const can = (id: string, zone: ZoneId, time: TimeOfDay) => candidates(zone, time).map((s) => s.id).includes(id);
    for (const t of ['dawn', 'dusk'] as TimeOfDay[]) expect(can('ide', 'shallow', t), `ide ${t}`).toBe(true);
    for (const t of ['day', 'night'] as TimeOfDay[]) expect(can('ide', 'shallow', t), `ide ${t}`).toBe(false);
    expect(can('ide', 'deep', 'dawn')).toBe(false);
    expect(can('asp', 'shallow', 'day')).toBe(true);
    for (const t of ['dawn', 'dusk', 'night'] as TimeOfDay[]) expect(can('asp', 'shallow', t), `asp ${t}`).toBe(false);
    expect(can('asp', 'deep', 'day')).toBe(false);
    expect(can('burbot', 'deep', 'night')).toBe(true);
    for (const t of ['dawn', 'day', 'dusk'] as TimeOfDay[]) expect(can('burbot', 'deep', t), `burbot ${t}`).toBe(false);
    expect(can('burbot', 'shallow', 'night')).toBe(false);
    // and the picker really rolls them there
    const seen = (zone: ZoneId, time: TimeOfDay, id: string) => seeds(1500).some((i) => pickSpecies(zone, time, seededRng(i)).id === id);
    expect(seen('shallow', 'dawn', 'ide')).toBe(true);
    expect(seen('shallow', 'day', 'asp')).toBe(true);
    expect(seen('deep', 'night', 'burbot')).toBe(true);
  });

  it('weights are 60/30/10, and the legendary has none', () => {
    expect(RARITY_WEIGHT).toEqual({ common: 60, uncommon: 30, rare: 10, legendary: 0 });
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

describe('big fish stay big (audit, 2026-11-24)', () => {
  const rolls = (id: string, n = 20000) => {
    const sp = speciesById(id)!;
    const rng = seededRng(5);
    return Array.from({ length: n }, () => rollLength(sp, rng)).sort((a, b) => a - b);
  };
  it('species of 80 cm and over use the gentler skew, legendary and smaller ones do not', () => {
    for (const id of ['catfish', 'pike', 'carp', 'eel', 'zander']) expect(lengthSkewFor(speciesById(id)!), id).toBe(FISH_TUNING.bigLengthSkew);
    for (const id of ['perch', 'bream', 'tench', 'roach', 'pale']) expect(lengthSkewFor(speciesById(id)!), id).toBe(FISH_TUNING.lengthSkew);
  });
  it('the median catfish is about 1 m and 20-27% of them weigh less than 3 kg', () => {
    const cat = speciesById('catfish')!;
    const l = rolls('catfish');
    expect(l[l.length / 2]).toBeGreaterThanOrEqual(98);
    expect(l[l.length / 2]).toBeLessThanOrEqual(108);
    const small = l.filter((x) => weightG(cat, x) < 3000).length / l.length;
    expect(small).toBeGreaterThan(0.2);
    expect(small).toBeLessThan(0.27);
  });
  it('small species keep the old skew: the median perch is still in the bottom third of its range', () => {
    const perch = speciesById('perch')!;
    const l = rolls('perch');
    expect(sizeShare(perch, l[l.length / 2])).toBeLessThan(0.3);
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

  it('caps shallow fish at the shallow cap (0.4) and everything at 1', () => {
    const eel = speciesById('eel')!;
    expect(fightProfile(eel, eel.lengthCm[1]).difficulty).toBe(0.4);
    for (const s of SPECIES) {
      const d = fightProfile(s, s.lengthCm[1]).difficulty;
      expect(d).toBeLessThanOrEqual(s.zone === 'shallow' ? 0.4 : 1);
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

import { describe, expect, it } from 'vitest';
import { POOL_SPECIES, speciesById } from '../data/fish';
import { FOTD_TUNING } from '../data/fotd';
import { RODS } from '../data/rods';
import { RARITY_WEIGHT, pickSpecies, spawnWeight } from '../fish';
import { bestStar, goldCount, recordCatch, newFishLog } from '../fishLog';
import { newPlayer, priceFor, toBagFish } from '../inventory';
import { reachableZones } from '../quests/quests';
import { seededRng } from '../random';
import { fishOfTheDay } from './fotd';

const starter = newPlayer();
const carbon = { ...newPlayer(), rodId: RODS[RODS.length - 1].id };

const dates = Array.from({ length: 60 }, (_, i) => `2026-${i < 30 ? '11' : '12'}-${String((i % 30) + 1).padStart(2, '0')}`);

describe('fishOfTheDay', () => {
  it('is the same species for the same date', () => {
    expect(fishOfTheDay('2026-11-24', starter)?.id).toBe(fishOfTheDay('2026-11-24', starter)?.id);
  });
  it('varies over days and never names the legendary', () => {
    const ids = new Set(dates.map((d) => fishOfTheDay(d, carbon)!.id));
    expect(ids.size).toBeGreaterThan(5);
    for (const id of ids) expect(speciesById(id)!.rarity).not.toBe('legendary');
  });
  it('is always reachable with the starter rod', () => {
    const zones = reachableZones(starter);
    for (const d of dates) expect(zones).toContain(fishOfTheDay(d, starter)!.zone);
  });
  it('is the same for starter and carbon rod whenever the pick is shallow', () => {
    for (const d of dates) {
      const c = fishOfTheDay(d, carbon)!;
      if (c.zone === 'shallow') expect(fishOfTheDay(d, starter)!.id).toBe(c.id);
    }
  });
  it('is undefined for a garbage date', () => {
    expect(fishOfTheDay('junk', starter)).toBeUndefined();
  });
});

describe('fish of the day effects', () => {
  const perch = speciesById('perch')!;
  it('doubles the spawn weight and stacks with a bait boost', () => {
    expect(spawnWeight(perch, undefined, 'perch')).toBe(RARITY_WEIGHT.uncommon * FOTD_TUNING.weightMult);
    expect(spawnWeight(perch, undefined, 'roach')).toBe(RARITY_WEIGHT.uncommon);
    expect(spawnWeight(perch, undefined, undefined)).toBe(RARITY_WEIGHT.uncommon);
  });
  it('picks it about twice as often', () => {
    const roach = speciesById('roach')!;
    const n = 20000;
    const count = (fotd?: string) => {
      const rng = seededRng(3);
      let c = 0;
      for (let i = 0; i < n; i++) if (pickSpecies('shallow', 'day', rng, undefined, fotd).id === roach.id) c++;
      return c;
    };
    expect(count('roach') / count()).toBeGreaterThan(1.6);
  });
  it('doubles the bag price only for that species', () => {
    const h = { speciesId: 'perch', lengthCm: 25, weightG: 200 };
    const base = priceFor(perch, 25);
    expect(toBagFish(h).price).toBe(base);
    expect(toBagFish(h, 'roach').price).toBe(base);
    expect(toBagFish(h, 'perch').price).toBe(base * FOTD_TUNING.priceMult);
  });
});

describe('best star in the log', () => {
  const perch = speciesById('perch')!;
  it('comes from the record length, and counts gold species', () => {
    let log = newFishLog();
    expect(bestStar(log, perch)).toBe('none');
    log = recordCatch(log, { speciesId: 'perch', lengthCm: 35, weightG: 500 }).log;
    expect(bestStar(log, perch)).toBe('gold');
    expect(goldCount(log)).toBe(1);
    expect(goldCount(newFishLog())).toBe(0);
    expect(POOL_SPECIES.length).toBe(12);
  });
});

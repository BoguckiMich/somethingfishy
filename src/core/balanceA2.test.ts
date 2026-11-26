import { describe, expect, it } from 'vitest';
import { newCatchBar } from './catchBar';
import { SHOP_BAITS, baitById } from './data/baits';
import { speciesById } from './data/fish';
import { DEEP_NIGHT_PRICE_MULT } from './data/shop';
import { STARTER_BAR_GEAR } from './data/barGear';
import { candidates, fightProfile } from './fish';
import { fightGear } from './fishingSession';
import { addCatch, newPlayer, toBagFish } from './inventory';
import { seededRng } from './random';

describe('balance A2: deep-night fish sell for 15 % less', () => {
  const hooked = { speciesId: 'catfish', lengthCm: 120, weightG: 8000 };
  it('only between 02:00 and 05:00 on the game clock', () => {
    const base = toBagFish(hooked).price;
    expect(DEEP_NIGHT_PRICE_MULT).toBe(0.85);
    expect(toBagFish(hooked, undefined, false, 23 * 60).price).toBe(base);
    expect(toBagFish(hooked, undefined, false, 119).price).toBe(base);
    expect(toBagFish(hooked, undefined, false, 120).price).toBe(Math.round(base * 0.85));
    expect(toBagFish(hooked, undefined, false, 299).price).toBe(Math.round(base * 0.85));
    expect(toBagFish(hooked, undefined, false, 300).price).toBe(base);
  });
  it('addCatch passes the minute on, and stacks with the fish of the day', () => {
    const base = toBagFish(hooked).price;
    expect(addCatch(newPlayer(), hooked, undefined, false, 180).fish.price).toBe(Math.round(base * 0.85));
    expect(addCatch(newPlayer(), hooked, 'catfish', false, 180).fish.price).toBe(Math.round(base * 2 * 0.85));
    expect(addCatch(newPlayer(), hooked).fish.price).toBe(base);
  });
});

describe('balance A2: corn and maggots', () => {
  it('corn is 15-20 coins for 10 and calms the fight; maggots wait x0.45', () => {
    const corn = SHOP_BAITS.find((b) => b.id === 'corn')!;
    expect(corn.pack!.price).toBeGreaterThanOrEqual(15);
    expect(corn.pack!.price).toBeLessThanOrEqual(20);
    expect(corn.calm).toBeGreaterThan(0);
    expect(baitById('maggots')!.waitFactor!.factor).toBe(0.45);
  });
  it('fightGear raises the calm for corn only, never lowers it', () => {
    expect(fightGear(STARTER_BAR_GEAR, undefined)).toBe(STARTER_BAR_GEAR);
    expect(fightGear(STARTER_BAR_GEAR, 'worm')).toBe(STARTER_BAR_GEAR);
    expect(fightGear(STARTER_BAR_GEAR, 'strip')).toBe(STARTER_BAR_GEAR);
    expect(fightGear(STARTER_BAR_GEAR, 'corn').baitCalm).toBe(baitById('corn')!.calm);
    expect(fightGear({ ...STARTER_BAR_GEAR, baitCalm: 0.9 }, 'corn').baitCalm).toBe(0.9);
  });
  it('a calmer fish moves less far and slower (the dead calm code now runs)', () => {
    const fish = { pattern: 'darting' as const, difficulty: 0.8 };
    const plain = newCatchBar(fish, STARTER_BAR_GEAR, seededRng(3));
    const calm = newCatchBar(fish, fightGear(STARTER_BAR_GEAR, 'corn'), seededRng(3));
    expect(calm.fishSpeed).toBeLessThan(plain.fishSpeed);
    expect(calm.fishTimer).toBeGreaterThan(plain.fishTimer * 0.99);
  });
});

describe('balance A2: dawn fish and the asp', () => {
  it('roach, rudd and bleak bite at dawn, so Dawn Chorus is what its name says', () => {
    for (const id of ['roach', 'rudd', 'bleak']) {
      expect(speciesById(id)!.times).toContain('dawn');
      expect(candidates('shallow', 'dawn').map((s) => s.id)).toContain(id);
    }
  });
  it('the asp keeps its own difficulty in the shallows', () => {
    const asp = speciesById('asp')!;
    expect(fightProfile(asp, asp.lengthCm[1]).difficulty).toBeGreaterThan(0.5);
    const perch = speciesById('perch')!;
    expect(fightProfile(perch, perch.lengthCm[1]).difficulty).toBeLessThanOrEqual(0.4);
  });
});

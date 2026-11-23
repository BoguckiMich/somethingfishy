import { describe, expect, it } from 'vitest';
import { speciesById } from './data/fish';
import { RODS } from './data/rods';
import { SHOP } from './data/shop';
import { LINES, REELS } from './data/tackle';
import type { GameEvent } from './events';
import type { HookedFish } from './fish';
import {
  addCatch,
  applyEvent,
  bagValue,
  buyLine,
  buyReel,
  buyRod,
  buyWorms,
  cheapestIndex,
  effectiveBarGear,
  equippedLine,
  equippedRod,
  freeWormsIfStuck,
  newPlayer,
  nextLine,
  nextReel,
  nextRod,
  priceFor,
  releasePending,
  sellAll,
  sellOne,
  swapForCheapest,
  type BagFish,
  type PlayerState,
} from './inventory';
import { seededRng } from './random';

const fish = (price: number, speciesId = 'roach'): BagFish => ({ speciesId, lengthCm: 20, weightG: 100, price });
const withBag = (n: number, base: Partial<PlayerState> = {}): PlayerState => ({
  ...newPlayer(),
  bag: Array.from({ length: n }, (_, i) => fish(10 + i)),
  ...base,
});

describe('newPlayer', () => {
  it('starts with 10 worms, no coins, an empty bag and the bamboo rod', () => {
    expect(newPlayer()).toEqual({ coins: 0, worms: 10, bag: [], rodId: 'bamboo', log: {}, daily: { lastBoxDate: null, streakTier: 0 }, quests: { date: null, rerollUsed: false, list: [] }, notes: { read: [] } });
    expect(equippedRod(newPlayer()).id).toBe('bamboo');
  });
});

describe('priceFor', () => {
  const roach = speciesById('roach')!; // 12..30 cm, base 6
  it('is 0.7x at the smallest size, 1.2x in the middle and 1.7x at the top (common)', () => {
    expect(priceFor(roach, 12)).toBe(4);
    expect(priceFor(roach, 21)).toBe(7);
    expect(priceFor(roach, 30)).toBe(10);
  });
  it('is rounded and grows with size', () => {
    const catfish = speciesById('catfish')!;
    expect(priceFor(catfish, 100)).toBeGreaterThan(priceFor(catfish, 70));
  });
  it('multiplies by rarity: common 1, uncommon 1.3, rare 2', () => {
    const perch = speciesById('perch')!; // uncommon, base 14, 10..35 cm
    const catfish = speciesById('catfish')!; // rare, base 100, 60..180 cm
    expect(priceFor(perch, 10)).toBe(Math.round(14 * 1.3 * 0.7));
    expect(priceFor(perch, 35)).toBe(Math.round(14 * 1.3 * 1.7));
    expect(priceFor(catfish, 60)).toBe(140);
    expect(priceFor(catfish, 180)).toBe(340);
  });
  it('a bleak sells for about 3-7', () => {
    const bleak = speciesById('bleak')!;
    expect(priceFor(bleak, 8)).toBe(3);
    expect(priceFor(bleak, 18)).toBe(7);
  });
  it('the Pale One is never worth anything', () => {
    expect(priceFor(speciesById('pale')!, 200)).toBe(0);
  });
});

describe('addCatch', () => {
  const hooked: HookedFish = { speciesId: 'roach', lengthCm: 30, weightG: 300 };
  it('puts the fish in the bag with its price fixed', () => {
    const r = addCatch(newPlayer(), hooked);
    expect(r.result).toBe('added');
    expect(r.state.bag).toEqual([{ speciesId: 'roach', lengthCm: 30, weightG: 300, price: 10 }]);
  });
  it('reports bagFull and leaves the state alone when 10 are in', () => {
    const full = withBag(SHOP.bagSlots);
    const r = addCatch(full, hooked);
    expect(r.result).toBe('bagFull');
    expect(r.state).toBe(full);
    expect(r.fish.price).toBe(10);
  });
});

describe('bag full choice', () => {
  it('release keeps the bag as it is', () => {
    const full = withBag(10);
    expect(releasePending(full)).toBe(full);
  });
  it('finds the cheapest fish and swaps it out', () => {
    const full = withBag(10);
    full.bag[4] = fish(2, 'bleak');
    expect(cheapestIndex(full.bag)).toBe(4);
    const r = swapForCheapest(full, fish(50, 'carp'));
    expect(r.removed.speciesId).toBe('bleak');
    expect(r.state.bag).toHaveLength(10);
    expect(r.state.bag.some((f) => f.speciesId === 'carp')).toBe(true);
    expect(r.state.bag.some((f) => f.speciesId === 'bleak')).toBe(false);
  });
});

describe('selling', () => {
  it('sellOne pays out and removes that fish', () => {
    const r = sellOne(withBag(3), 1);
    expect(r.ok).toBe(true);
    expect(r.state.coins).toBe(11);
    expect(r.state.bag.map((f) => f.price)).toEqual([10, 12]);
  });
  it('sellOne ignores a bad index', () => {
    const p = withBag(2);
    const r = sellOne(p, 5);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(p);
  });
  it('sellAll pays the whole bag and empties it', () => {
    const p = withBag(3, { coins: 5 });
    expect(bagValue(p.bag)).toBe(33);
    const r = sellAll(p);
    expect(r.state.coins).toBe(38);
    expect(r.state.bag).toEqual([]);
  });
  it('sellAll with an empty bag does nothing', () => {
    expect(sellAll(newPlayer()).ok).toBe(false);
  });
});

describe('buyWorms', () => {
  it('sells a pack of 10 for 10 coins', () => {
    const r = buyWorms({ ...newPlayer(), coins: 25, worms: 3 });
    expect(r.ok).toBe(true);
    expect(r.state.coins).toBe(15);
    expect(r.state.worms).toBe(13);
  });
  it('fails with the shortfall when coins are short', () => {
    const p = { ...newPlayer(), coins: 4 };
    const r = buyWorms(p);
    expect(r).toMatchObject({ ok: false, error: 'needCoins', missing: 6 });
    expect(r.state).toBe(p);
  });
});

describe('rods', () => {
  it('nextRod is the one after the equipped rod, or undefined for the best', () => {
    expect(nextRod(newPlayer())?.id).toBe('fiberglass');
    expect(nextRod({ ...newPlayer(), rodId: 'fiberglass' })?.id).toBe('carbon');
    expect(nextRod({ ...newPlayer(), rodId: 'carbon' })).toBeUndefined();
  });
  it('buyRod pays and equips at once', () => {
    const r = buyRod({ ...newPlayer(), coins: 300 });
    expect(r.ok).toBe(true);
    expect(r.state.rodId).toBe('fiberglass');
    expect(r.state.coins).toBe(50);
  });
  it('buyRod fails when short, and when already on the best rod', () => {
    expect(buyRod({ ...newPlayer(), coins: 100 })).toMatchObject({ ok: false, error: 'needCoins', missing: 150 });
    expect(buyRod({ ...newPlayer(), rodId: 'carbon', coins: 5000 })).toMatchObject({ ok: false, error: 'bestRod' });
  });
  it('rods get bigger catch zones: 0.30, 0.34, 0.38', () => {
    expect(RODS.map((r) => r.barGear.zoneSize)).toEqual([0.3, 0.34, 0.38]);
    expect(RODS.map((r) => r.price)).toEqual([0, 250, 1200]);
  });
});

describe('lines and reels (slice 15a)', () => {
  it('start with neither; the next one is the first of each track', () => {
    const p = newPlayer();
    expect(equippedLine(p)).toBeUndefined();
    expect(nextLine(p)?.id).toBe('braided');
    expect(nextReel(p)?.id).toBe('smooth');
    expect(nextLine({ ...p, lineId: 'braided' })?.id).toBe('fluoro');
    expect(nextLine({ ...p, lineId: 'fluoro' })).toBeUndefined();
    expect(nextReel({ ...p, reelId: 'smooth' })?.id).toBe('pro');
    expect(nextReel({ ...p, reelId: 'pro' })).toBeUndefined();
  });
  it('prices: 600 / 2000 for lines, 1000 / 3500 for reels', () => {
    expect(LINES.map((l) => l.price)).toEqual([600, 2000]);
    expect(REELS.map((r) => r.price)).toEqual([1000, 3500]);
  });
  it('buyLine and buyReel pay and own it at once, in order', () => {
    let r = buyLine({ ...newPlayer(), coins: 3000 });
    expect(r.state).toMatchObject({ lineId: 'braided', coins: 2400 });
    r = buyLine(r.state);
    expect(r.state).toMatchObject({ lineId: 'fluoro', coins: 400 });
    expect(buyLine(r.state)).toMatchObject({ ok: false, error: 'bestLine' });
    let q = buyReel({ ...newPlayer(), coins: 5000 });
    expect(q.state).toMatchObject({ reelId: 'smooth', coins: 4000 });
    q = buyReel(q.state);
    expect(q.state).toMatchObject({ reelId: 'pro', coins: 500 });
    expect(buyReel(q.state)).toMatchObject({ ok: false, error: 'bestReel' });
  });
  it('buying fails when short and says how much is missing', () => {
    expect(buyLine({ ...newPlayer(), coins: 500 })).toMatchObject({ ok: false, error: 'needCoins', missing: 100 });
    expect(buyReel({ ...newPlayer(), coins: 900 })).toMatchObject({ ok: false, error: 'needCoins', missing: 100 });
  });
  it('effectiveBarGear is the rod gear with the multipliers applied', () => {
    const rod = RODS[2].barGear;
    expect(effectiveBarGear({ ...newPlayer(), rodId: 'carbon' })).toEqual(rod);
    const g = effectiveBarGear({ ...newPlayer(), rodId: 'carbon', lineId: 'fluoro', reelId: 'pro' });
    expect(g.zoneSize).toBe(rod.zoneSize);
    expect(g.lineDrain).toBeCloseTo(rod.lineDrain * 0.7);
    expect(g.reelResponse).toBeCloseTo(rod.reelResponse * 1.4);
    expect(g.baitCalm).toBe(rod.baitCalm);
  });
  it('an unknown id counts as none', () => {
    expect(effectiveBarGear({ ...newPlayer(), lineId: 'rope', reelId: 'crank' })).toEqual(RODS[0].barGear);
  });
});

describe('freeWormsIfStuck (soft-lock guard)', () => {
  it('grants 5 worms with no worms, too few coins for a pack and an empty bag', () => {
    const r = freeWormsIfStuck({ ...newPlayer(), worms: 0, coins: 3 });
    expect(r.granted).toBe(true);
    expect(r.state.worms).toBe(5);
  });
  it('does nothing if any way out remains', () => {
    for (const p of [
      { ...newPlayer(), worms: 1 },
      { ...newPlayer(), worms: 0, coins: 10 },
      { ...withBag(1), worms: 0 },
    ]) {
      const r = freeWormsIfStuck(p);
      expect(r.granted).toBe(false);
      expect(r.state).toBe(p);
    }
  });
});

describe('applyEvent (worm use)', () => {
  const caught: GameEvent = { type: 'fishCaught', zone: 'shallow', pattern: 'smooth', difficulty: 0.1, fightMs: 5000, speciesId: 'roach', lengthCm: 20, weightG: 100 };
  const lost: GameEvent = { type: 'fishLost', zone: 'shallow', pattern: 'smooth', difficulty: 0.1, speciesId: 'roach' };

  it('a caught fish always uses the worm', () => {
    const r = applyEvent(newPlayer(), caught, seededRng(1));
    expect(r.wormUsed).toBe(true);
    expect(r.state.worms).toBe(9);
  });
  it('a lost fish uses it about half the time, through the rng', () => {
    expect(applyEvent(newPlayer(), lost, () => 0.2).wormUsed).toBe(true);
    expect(applyEvent(newPlayer(), lost, () => 0.7).wormUsed).toBe(false);
    const rng = seededRng(9);
    let used = 0;
    for (let i = 0; i < 400; i++) if (applyEvent(newPlayer(), lost, rng).wormUsed) used++;
    expect(used).toBeGreaterThan(150);
    expect(used).toBeLessThan(250);
  });
  it('scares, missed bites and other events never cost a worm', () => {
    const events: GameEvent[] = [
      { type: 'fishEscaped', reason: 'tooEarly' },
      { type: 'fishEscaped', reason: 'tooLate' },
      { type: 'nibble' },
      { type: 'bite' },
      { type: 'hooked', zone: 'shallow' },
    ];
    for (const e of events) {
      const p = newPlayer();
      const r = applyEvent(p, e, () => 0);
      expect(r.wormUsed).toBe(false);
      expect(r.state).toBe(p);
    }
  });
  it('never goes below zero worms', () => {
    expect(applyEvent({ ...newPlayer(), worms: 0 }, caught, () => 0).state.worms).toBe(0);
  });
});

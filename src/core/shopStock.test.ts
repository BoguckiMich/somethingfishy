import { describe, expect, it } from 'vitest';
import { buyCampItem } from './camp';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { BASIC_BAIT, sold } from './data/shopStock';
import { buyBait, buyLine, buyNightKit, buyReel, buyRod, buyWorms, newPlayer } from './inventory';

/** Everything the Buy tab offered at Quiet Lake before slice 29 (worms, baits, rods, lines, reels, night kit, camp), pinned by hand. */
const BEFORE_SLICE_29 = [
  'worms', 'corn', 'maggots', 'strip',
  'fiberglass', 'carbon', 'braided', 'fluoro', 'smooth', 'pro', 'lantern',
  'campfire', 'deckchair', 'dogbed', 'tent', 'lights', 'windsock',
];

const lake = QUIET_LAKE.shop;
const river = RIVER_BEND.shop;
/** Plenty of coins and the fiberglass rod, so the night kit is for sale and the next rod (carbon) is the one in question. */
const rich = () => ({ ...newPlayer(), coins: 100_000, rodId: 'fiberglass' });

describe('shop stock per place', () => {
  it('Quiet Lake sells exactly what it sold before', () => {
    const items = [...lake.bait, ...lake.gear, ...lake.camp];
    expect([...items].sort()).toEqual([...BEFORE_SLICE_29].sort());
  });

  it('the basics are sold everywhere; glow bait nowhere', () => {
    for (const stock of [lake, river]) {
      for (const id of BASIC_BAIT) expect(sold(stock, id)).toBe(true);
      expect(sold(stock, 'glow')).toBe(false);
    }
  });

  it('River bend has no gear and no camp yet, and says so kindly', () => {
    expect(river.gear).toEqual([]);
    expect(river.camp).toEqual([]);
    expect(river.gearEmpty).toContain('river tackle');
  });
});

describe('buying is place-aware', () => {
  it('worms and baits can be bought at the river', () => {
    expect(buyWorms(rich(), river).ok).toBe(true);
    expect(buyBait(rich(), 'corn', river).ok).toBe(true);
  });

  it('rod, line, reel, night kit and camp items are refused at the river with notSoldHere, state untouched', () => {
    const p = rich();
    for (const r of [buyRod(p, river), buyLine(p, river), buyReel(p, river), buyNightKit(p, river), buyCampItem(p, 'tent', river)]) {
      expect(r).toMatchObject({ ok: false, error: 'notSoldHere' });
      expect(r.state).toBe(p);
    }
  });

  it('the same purchases still work at Quiet Lake, with or without the stock argument', () => {
    // The carbon rod, braided line and smooth reel wait for checklist bundles (gearGates), so those are refused for 'locked', not for the place.
    expect(buyRod(rich(), lake)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyLine(rich(), lake)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyReel(rich(), lake)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyNightKit(rich(), lake).ok).toBe(true);
    expect(buyNightKit(rich()).ok).toBe(true);
    expect(buyCampItem(rich(), 'tent', lake).ok).toBe(true);
    expect(buyRod({ ...newPlayer(), coins: 1000 }, lake).ok).toBe(true);
    expect(buyRod({ ...newPlayer(), coins: 1000 }).ok).toBe(true);
  });

  it('owned gear stays owned: a refused purchase leaves the equipped rod, line and reel alone', () => {
    const p = { ...rich(), lineId: 'braided', reelId: 'smooth' };
    const r = buyRod(p, river);
    expect(r.state.rodId).toBe('fiberglass');
    expect(r.state.lineId).toBe('braided');
    expect(r.state.reelId).toBe('smooth');
  });
});

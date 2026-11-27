import { describe, expect, it } from 'vitest';
import { buyCampItem } from './camp';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { BASIC_BAIT, sold } from './data/shopStock';
import { buyBait, buyLine, buyNightKit, buyReel, buyRiverGear, buyRod, buyWorms, newPlayer, riverGearOf } from './inventory';
import { withBundlesDone } from './checklist/checklist';

/** Everything the Buy tab offered at Quiet Lake before slice 29 (worms, baits, rods, lines, reels, night kit, camp), pinned by hand. */
const BEFORE_SLICE_29 = [
  'worms', 'corn', 'maggots', 'strip', 'treats', // the dog treats joined the basics in slice 30
  'fiberglass', 'carbon', 'braided', 'fluoro', 'smooth', 'pro', 'lantern',
  'campfire', 'deckchair', 'dogbed', 'tent', 'lights', 'windsock',
];

const lake = QUIET_LAKE.shop;
const river = RIVER_BEND.shop;
/** Plenty of coins and the fiberglass rod, so the night kit is for sale and the next rod (carbon) is the one in question. */
const rich = () => ({ ...newPlayer(), coins: 100_000, rodId: 'fiberglass' });

describe('shop stock per place', () => {
  it('Quiet Lake sells exactly what it sold before (plus the dog treats)', () => {
    const items = [...lake.bait, ...lake.gear, ...lake.camp];
    expect([...items].sort()).toEqual([...BEFORE_SLICE_29].sort());
  });

  it('the basics are sold everywhere; glow bait nowhere', () => {
    for (const stock of [lake, river]) {
      for (const id of BASIC_BAIT) expect(sold(stock, id)).toBe(true);
      expect(sold(stock, 'glow')).toBe(false);
    }
  });

  it('River bend sells the two river items under "River tackle" and no camp; the lake sells neither', () => {
    expect(river.gear).toEqual(['float', 'lead', 'spinrod', 'spinner', 'wobbler', 'jig']); // the spinning rod and lures joined in slice 32
    expect(river.gearTitle).toBe('River tackle');
    expect(river.camp).toEqual([]);
    expect(sold(lake, 'float')).toBe(false);
    expect(sold(lake, 'lead')).toBe(false);
    expect(sold(river, 'float')).toBe(true);
    expect(sold(river, 'lead')).toBe(true);
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

describe('river gear purchases (slice 25g)', () => {
  const open2 = () => withBundlesDone(rich(), 2, 'river-bend');
  it('the prices are 700 and 900', () => {
    const f = buyRiverGear(withBundlesDone(rich(), 1, 'river-bend'), 'float', river);
    const l = buyRiverGear(open2(), 'lead', river);
    expect(f.ok && f.state.coins).toBe(100_000 - 700);
    expect(l.ok && l.state.coins).toBe(100_000 - 900);
  });
  it('is refused while the river bundles are not done, even with the coins', () => {
    expect(buyRiverGear(rich(), 'float', river)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyRiverGear(withBundlesDone(rich(), 1, 'river-bend'), 'lead', river)).toMatchObject({ ok: false, error: 'locked' });
    // The lake's bundles do not count.
    expect(buyRiverGear(withBundlesDone(rich(), 4, 'quiet-lake'), 'float', river)).toMatchObject({ ok: false, error: 'locked' });
  });
  it('is refused at Quiet Lake with notSoldHere, state untouched', () => {
    const p = open2();
    for (const id of ['float', 'lead']) {
      const r = buyRiverGear(p, id, lake);
      expect(r).toMatchObject({ ok: false, error: 'notSoldHere' });
      expect(r.state).toBe(p);
    }
    expect(buyRiverGear(p, 'nope', river)).toMatchObject({ ok: false, error: 'notSoldHere' });
  });
  it('needs the coins, and says how many are missing', () => {
    const p = { ...open2(), coins: 650 };
    expect(buyRiverGear(p, 'float', river)).toMatchObject({ ok: false, error: 'needCoins', missing: 50 });
  });
  it('deducts the coins, sets the ownership, and cannot be bought twice', () => {
    const p = open2();
    expect(riverGearOf(p)).toEqual({ float: false, lead: false });
    const a = buyRiverGear(p, 'float', river);
    expect(a.ok).toBe(true);
    expect(a.state.coins).toBe(p.coins - 700);
    expect(riverGearOf(a.state)).toEqual({ float: true, lead: false });
    expect(buyRiverGear(a.state, 'float', river)).toMatchObject({ ok: false, error: 'owned' });
    const b = buyRiverGear(a.state, 'lead', river);
    expect(riverGearOf(b.state)).toEqual({ float: true, lead: true });
    expect(b.state.coins).toBe(p.coins - 1600);
  });
});

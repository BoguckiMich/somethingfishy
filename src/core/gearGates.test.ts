import { describe, expect, it } from 'vitest';
import { allButPetrol, withBundlesDone } from './checklist/checklist';
import { CHECKLIST } from './data/checklist';
import { GEAR_GATES } from './data/gearGates';
import { LINES, REELS } from './data/tackle';
import { RODS } from './data/rods';
import { bundlesDone, gateFor, gearUnlocked } from './gearGates';
import { buyLine, buyReel, buyRod, newPlayer, type PlayerState } from './inventory';

/** A player with the first n bundles finished. */
const withBundles = (n: number, p: PlayerState = newPlayer()): PlayerState => withBundlesDone(p, n);

describe('gear gates (slice 23a)', () => {
  it('the gates are 1 / 1 / 2 / 4 / 4 bundles', () => {
    expect(GEAR_GATES).toEqual({ braided: 1, smooth: 1, carbon: 2, fluoro: 4, pro: 4 });
    for (const id of Object.keys(GEAR_GATES)) {
      expect([...RODS, ...LINES, ...REELS].some((g) => g.id === id)).toBe(true);
    }
  });
  it('starter gear is open from the start', () => {
    for (const id of ['bamboo', 'fiberglass', 'worms', 'corn', 'maggots', 'strip', 'lantern']) {
      expect(gateFor(id)).toBe(0);
      expect(gearUnlocked(id, newPlayer())).toBe(true);
    }
  });
  it('bundlesDone counts finished bundles only', () => {
    expect(bundlesDone(newPlayer())).toBe(0);
    expect(bundlesDone(withBundles(3))).toBe(3);
    expect(bundlesDone(allButPetrol(newPlayer(), true))).toBe(CHECKLIST.length);
    const partial = { ...newPlayer(), checklist: { [CHECKLIST[0].id]: CHECKLIST[0].slots.map((_, i) => i === 0) } };
    expect(bundlesDone(partial)).toBe(0);
  });
  it('unlocks at the threshold', () => {
    expect(gearUnlocked('braided', withBundles(0))).toBe(false);
    expect(gearUnlocked('braided', withBundles(1))).toBe(true);
    expect(gearUnlocked('smooth', withBundles(1))).toBe(true);
    expect(gearUnlocked('carbon', withBundles(1))).toBe(false);
    expect(gearUnlocked('carbon', withBundles(2))).toBe(true);
    expect(gearUnlocked('fluoro', withBundles(3))).toBe(false);
    expect(gearUnlocked('pro', withBundles(4))).toBe(true);
  });
  it('a locked item cannot be bought even with the coins', () => {
    const rich = { ...newPlayer(), coins: 99999 };
    expect(buyLine(rich)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyReel(rich)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyRod({ ...rich, rodId: 'fiberglass' })).toMatchObject({ ok: false, error: 'locked' });
    expect(buyLine(withBundles(1, rich)).ok).toBe(true);
    expect(buyRod(withBundles(2, { ...rich, rodId: 'fiberglass' })).ok).toBe(true);
  });
  it('owned gear stays owned with no bundles (old saves)', () => {
    const old: PlayerState = { ...newPlayer(), rodId: 'carbon', lineId: 'fluoro', reelId: 'pro' };
    expect(bundlesDone(old)).toBe(0);
    expect(old.rodId).toBe('carbon');
    // nothing to buy next, and nothing is taken away
    expect(buyRod(old)).toMatchObject({ error: 'bestRod' });
    expect(buyLine(old)).toMatchObject({ error: 'bestLine' });
  });
});

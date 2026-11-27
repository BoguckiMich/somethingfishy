import { describe, expect, it } from 'vitest';
import { allButPetrol, withBundlesDone } from './checklist/checklist';
import { ALL_BUNDLES, CHECKLIST } from './data/checklist';
import { GEAR_GATES } from './data/gearGates';
import { LINES, REELS } from './data/tackle';
import { RIVER_GEAR_ITEMS } from './data/riverGear';
import { RODS } from './data/rods';
import { bundlesDone, gateFor, gateText, gearOpenedBy, gearUnlocked } from './gearGates';
import { buyLine, buyReel, buyRod, newPlayer, type PlayerState } from './inventory';

/** A player with exactly these bundles finished (every slot filled). */
const withDone = (ids: string[], p: PlayerState = newPlayer()): PlayerState => ({
  ...p,
  checklist: Object.fromEntries(CHECKLIST.map((b) => [b.id, b.slots.map(() => ids.includes(b.id))])),
});
/** A player with the first n bundles finished (the dev flag ?bundles=N). */
const withBundles = (n: number, p: PlayerState = newPlayer()): PlayerState => withBundlesDone(p, n);

describe('gear gates (slice 23a, reworked in balance A2)', () => {
  it('carbon waits for The Bottom of Things, fluoro and pro for Night Shift, braided and smooth for one main bundle', () => {
    expect(GEAR_GATES.carbon).toEqual({ bundle: 'bottom-of-things' });
    expect(GEAR_GATES.fluoro).toEqual({ bundle: 'night-shift' });
    expect(GEAR_GATES.pro).toEqual({ bundle: 'night-shift' });
    expect(GEAR_GATES.braided).toMatchObject({ count: 1, excluding: ['duck-tax', 'petrol'] });
    expect(GEAR_GATES.smooth).toMatchObject({ count: 1, excluding: ['duck-tax', 'petrol'] });
    for (const id of Object.keys(GEAR_GATES)) {
      expect([...RODS, ...LINES, ...REELS, ...RIVER_GEAR_ITEMS].some((g) => g.id === id)).toBe(true);
    }
    for (const g of Object.values(GEAR_GATES)) if ('bundle' in g) expect(CHECKLIST.some((b) => b.id === g.bundle)).toBe(true);
  });
  it('starter gear is open from the start', () => {
    for (const id of ['bamboo', 'fiberglass', 'worms', 'corn', 'maggots', 'strip', 'lantern']) {
      expect(gateFor(id)).toBeUndefined();
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
  it('carbon opens only with The Bottom of Things, whatever else is done', () => {
    expect(gearUnlocked('carbon', withDone(['dawn-chorus', 'night-shift', 'shiny-ones', 'duck-tax', 'petrol']))).toBe(false);
    expect(gearUnlocked('carbon', withDone(['bottom-of-things']))).toBe(true);
  });
  it('fluoro and pro open only with Night Shift', () => {
    expect(gearUnlocked('fluoro', withDone(['dawn-chorus', 'bottom-of-things', 'shiny-ones']))).toBe(false);
    expect(gearUnlocked('pro', withDone(['dawn-chorus', 'bottom-of-things', 'shiny-ones']))).toBe(false);
    expect(gearUnlocked('fluoro', withDone(['night-shift']))).toBe(true);
    expect(gearUnlocked('pro', withDone(['night-shift']))).toBe(true);
  });
  it('braided and smooth open with any one main bundle, but never with Duck Tax or Petrol Money alone', () => {
    for (const id of ['braided', 'smooth']) {
      expect(gearUnlocked(id, newPlayer())).toBe(false);
      expect(gearUnlocked(id, withDone(['duck-tax']))).toBe(false);
      expect(gearUnlocked(id, withDone(['petrol']))).toBe(false);
      expect(gearUnlocked(id, withDone(['duck-tax', 'petrol']))).toBe(false);
      for (const b of ['dawn-chorus', 'night-shift', 'bottom-of-things', 'shiny-ones']) expect(gearUnlocked(id, withDone([b]))).toBe(true);
    }
  });
  it('the lock text names the bundle, or counts the main ones', () => {
    expect(gateText('carbon', newPlayer())).toBe('Finish The Bottom of Things (Quiet Lake checklist: tap the car)');
    expect(gateText('fluoro', newPlayer())).toBe('Finish Night Shift (Quiet Lake checklist: tap the car)');
    expect(gateText('braided', newPlayer())).toBe('Finish a main bundle 0/1 (Quiet Lake checklist: tap the car)');
    expect(gateText('braided', withDone(['duck-tax']))).toBe('Finish a main bundle 0/1 (Quiet Lake checklist: tap the car)');
    expect(gateText('bamboo', newPlayer())).toBe('');
  });
  it('a locked item cannot be bought even with the coins', () => {
    const rich = { ...newPlayer(), coins: 99999 };
    expect(buyLine(rich)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyReel(rich)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyRod({ ...rich, rodId: 'fiberglass' })).toMatchObject({ ok: false, error: 'locked' });
    expect(buyRod(withDone(['night-shift'], { ...rich, rodId: 'fiberglass' }))).toMatchObject({ ok: false, error: 'locked' });
    expect(buyLine(withDone(['dawn-chorus'], rich)).ok).toBe(true);
    expect(buyRod(withDone(['bottom-of-things'], { ...rich, rodId: 'fiberglass' })).ok).toBe(true);
    // The line track is bought in order: fluoro is the second line, so braided first, then Night Shift.
    const braided = { ...withDone(['dawn-chorus'], rich), lineId: 'braided' };
    expect(buyLine(braided)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyLine(withDone(['dawn-chorus', 'night-shift'], { ...rich, lineId: 'braided' })).ok).toBe(true);
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

describe('gearOpenedBy (A3: the "new gear" cue)', () => {
  it('names the gear a just-finished bundle opened', () => {
    expect(gearOpenedBy('bottom-of-things', withDone(['bottom-of-things'])).sort()).toEqual(['braided', 'carbon', 'smooth']); // the first main bundle also opens the count gates
    expect(gearOpenedBy('night-shift', withDone(['bottom-of-things', 'night-shift'])).sort()).toEqual(['fluoro', 'pro']);
  });
  it('a bundle that opens nothing, or Duck Tax and Petrol Money, gives nothing', () => {
    expect(gearOpenedBy('duck-tax', withDone(['duck-tax']))).toEqual([]);
    expect(gearOpenedBy('petrol', withDone(['petrol']))).toEqual([]);
  });
});

describe('river gear gates (slice 25g)', () => {
  /** A player with exactly these river bundles finished. */
  const riverDone = (ids: string[], p: PlayerState = newPlayer()): PlayerState => ({
    ...p,
    checklist: Object.fromEntries(ALL_BUNDLES.map((b) => [b.id, b.slots.map(() => ids.includes(b.id))])),
  });
  it('the float waits for one finished river bundle, the lead for two', () => {
    expect(GEAR_GATES.float).toMatchObject({ count: 1, place: 'river-bend' });
    expect(GEAR_GATES.lead).toMatchObject({ count: 2, place: 'river-bend' });
    expect(gearUnlocked('float', newPlayer())).toBe(false);
    expect(gearUnlocked('lead', newPlayer())).toBe(false);
    expect(gearUnlocked('float', riverDone(['swift-water']))).toBe(true);
    expect(gearUnlocked('lead', riverDone(['swift-water']))).toBe(false);
    expect(gearUnlocked('lead', riverDone(['swift-water', 'the-hunter']))).toBe(true);
  });
  it('counts the RIVER checklist, not the lake\'s: four finished lake bundles open nothing at the river', () => {
    const lake = withDone(['dawn-chorus', 'night-shift', 'bottom-of-things', 'shiny-ones']);
    expect(gearUnlocked('float', lake)).toBe(false);
    expect(gearUnlocked('lead', lake)).toBe(false);
    // ...and river bundles do not open the lake's count gates
    expect(gearUnlocked('braided', riverDone(['swift-water', 'the-hunter']))).toBe(false);
  });
  it('the coin-only Ferry Fare does not count', () => {
    expect(gearUnlocked('float', riverDone(['ferry-fare']))).toBe(false);
    expect(gearUnlocked('lead', riverDone(['ferry-fare', 'swift-water']))).toBe(false);
  });
  it('the dev flag ?bundles=N at the river opens them (N = 1 float, N = 2 lead)', () => {
    expect(gearUnlocked('float', withBundlesDone(newPlayer(), 1, 'river-bend'))).toBe(true);
    expect(gearUnlocked('lead', withBundlesDone(newPlayer(), 1, 'river-bend'))).toBe(false);
    expect(gearUnlocked('lead', withBundlesDone(newPlayer(), 2, 'river-bend'))).toBe(true);
  });
  it('the lock line says how many river bundles are missing', () => {
    expect(gateText('float', newPlayer())).toBe('Unlocks after 1 river checklist bundle (0/1)');
    expect(gateText('lead', newPlayer())).toBe('Unlocks after 2 river checklist bundles (0/2)');
    expect(gateText('lead', riverDone(['swift-water']))).toBe('Unlocks after 2 river checklist bundles (1/2)');
  });
  it('finishing a river bundle announces the gear it opened; a lake bundle never does', () => {
    expect(gearOpenedBy('swift-water', riverDone(['swift-water']))).toEqual(['float']);
    expect(gearOpenedBy('the-hunter', riverDone(['swift-water', 'the-hunter']))).toEqual(['lead']);
    expect(gearOpenedBy('ferry-fare', riverDone(['ferry-fare']))).toEqual([]);
    expect(gearOpenedBy('dawn-chorus', riverDone(['swift-water', 'the-hunter', 'dawn-chorus']))).toEqual(['braided', 'smooth']);
  });
});

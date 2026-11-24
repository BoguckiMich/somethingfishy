import { describe, expect, it } from 'vitest';
import { allCamp, buyCampItem, campOwned, hasCamp, normalizeCamp, windsockLevel } from './camp';
import { CAMP_ITEMS } from './data/camp';
import { newPlayer } from './inventory';
import { normalizeSave } from './save';

const rich = () => ({ ...newPlayer(), coins: 10_000 });

describe('camp items', () => {
  it('have the agreed prices and are all for sale from the start', () => {
    const price = Object.fromEntries(CAMP_ITEMS.map((c) => [c.id, c.price]));
    expect(price).toEqual({ campfire: 800, deckchair: 600, dogbed: 1000, tent: 1500, lights: 1200, windsock: 400 });
    for (const c of CAMP_ITEMS) expect(buyCampItem(rich(), c.id).ok).toBe(true);
  });

  it('buying takes the price and adds the item once', () => {
    const r = buyCampItem(rich(), 'tent');
    expect(r.ok).toBe(true);
    expect(r.state.coins).toBe(8500);
    expect(campOwned(r.state)).toEqual(['tent']);
    expect(hasCamp(r.state, 'tent')).toBe(true);
    expect(hasCamp(r.state, 'campfire')).toBe(false);
  });

  it('refuses without coins and says how many are missing', () => {
    const p = { ...newPlayer(), coins: 350 };
    const r = buyCampItem(p, 'windsock');
    expect(r).toMatchObject({ ok: false, error: 'needCoins', missing: 50 });
    expect(r.state).toBe(p);
  });

  it('refuses a second copy and an unknown id, without touching the state', () => {
    const once = buyCampItem(rich(), 'campfire').state;
    const again = buyCampItem(once, 'campfire');
    expect(again).toMatchObject({ ok: false, error: 'owned' });
    expect(again.state).toBe(once);
    expect(buyCampItem(once, 'sofa')).toMatchObject({ ok: false, error: 'notSold' });
  });

  it('keeps the owned list in shop order whatever the buying order', () => {
    let s = rich();
    for (const id of ['windsock', 'campfire', 'tent']) s = buyCampItem(s, id).state;
    expect(campOwned(s)).toEqual(['campfire', 'tent', 'windsock']);
  });

  it('does not mutate its input', () => {
    const p = rich();
    const before = JSON.stringify(p);
    buyCampItem(p, 'lights');
    expect(JSON.stringify(p)).toBe(before);
  });

  it('normalises anything saved', () => {
    expect(normalizeCamp(undefined)).toEqual([]);
    expect(normalizeCamp('tent')).toEqual([]);
    expect(normalizeCamp(['tent', 'tent', 'sofa', 7, 'campfire'])).toEqual(['campfire', 'tent']);
    expect(allCamp()).toHaveLength(6);
  });

  it('is saved only when something is owned, with no version bump', () => {
    const empty = normalizeSave({ player: { ...newPlayer(), camp: [] }, clock: {} });
    expect('camp' in empty.player).toBe(false);
    const junk = normalizeSave({ player: { ...newPlayer(), camp: ['nope'] }, clock: {} });
    expect('camp' in junk.player).toBe(false);
    const some = normalizeSave({ player: { ...newPlayer(), camp: ['windsock', 'campfire', 'campfire'] }, clock: {} });
    expect(some.player.camp).toEqual(['campfire', 'windsock']);
    expect(some.version).toBe(1);
  });
});

describe('the windsock', () => {
  it('is limp when sunny, full when windy and half blown out otherwise', () => {
    expect(windsockLevel('sunny')).toBe(0);
    expect(windsockLevel('windy')).toBe(2);
    for (const w of ['overcast', 'rain', 'fog'] as const) expect(windsockLevel(w)).toBe(1);
    expect(windsockLevel(undefined)).toBe(0);
  });
});

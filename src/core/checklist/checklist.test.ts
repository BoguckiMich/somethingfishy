import { describe, expect, it } from 'vitest';
import { CHECKLIST } from '../data/checklist';
import { speciesById } from '../data/fish';
import { lengthForStar } from '../data/stars';
import { newPlayer, type BagFish, type PlayerState } from '../inventory';
import { normalizeSave } from '../save';
import {
  allButPetrol, checklistOrder, firstOpenBundle, giveWarning, slotBlockReason, allDone, bundleDone, canFill, checklistOf, checklistRewardText, doneCount, fits, fittingSlots, giveFish, normalizeChecklist, payCoins, slotFilled,
} from './checklist';

const fish = (speciesId: string, price = 10, lengthCm = 15): BagFish => ({ speciesId, lengthCm, weightG: 100, price });
const gold = (id: string, price = 50): BagFish => ({ speciesId: id, lengthCm: lengthForStar(speciesById(id)!, 'gold'), weightG: 100, price });
const withBag = (bag: BagFish[], extra: Partial<PlayerState> = {}): PlayerState => ({ ...newPlayer(), bag, ...extra });

describe('data', () => {
  it('has six bundles with unique ids and petrol last', () => {
    expect(CHECKLIST).toHaveLength(6);
    expect(new Set(CHECKLIST.map((b) => b.id)).size).toBe(6);
    expect(CHECKLIST[5].id).toBe('petrol');
  });
  it('only names real species', () => {
    for (const b of CHECKLIST) for (const s of b.slots) if (s.kind === 'species') expect(speciesById(s.id)).toBeDefined();
  });
});

describe('fits', () => {
  it('matches the species only', () => {
    expect(fits({ kind: 'species', id: 'roach' }, fish('roach'))).toBe(true);
    expect(fits({ kind: 'species', id: 'roach' }, fish('rudd'))).toBe(false);
  });
  it('checks star thresholds', () => {
    const perch = speciesById('perch')!;
    const silver: BagFish = { ...fish('perch'), lengthCm: lengthForStar(perch, 'silver') };
    expect(fits({ kind: 'star', min: 'silver' }, silver)).toBe(true);
    expect(fits({ kind: 'star', min: 'gold' }, silver)).toBe(false);
    expect(fits({ kind: 'star', min: 'silver' }, gold('perch'))).toBe(true);
    expect(fits({ kind: 'star', min: 'gold' }, gold('perch'))).toBe(true);
    expect(fits({ kind: 'star', min: 'silver' }, { ...fish('perch'), lengthCm: 10 })).toBe(false);
  });
  it('never takes the Pale One or a coin slot', () => {
    expect(fits({ kind: 'star', min: 'silver' }, fish('pale', 0, 300))).toBe(false);
    expect(fits({ kind: 'species', id: 'pale' }, fish('pale'))).toBe(false);
    expect(fits({ kind: 'coins', amount: 5 }, fish('roach'))).toBe(false);
  });
});

describe('giveFish', () => {
  it('refuses with an empty bag or the wrong species', () => {
    const p = withBag([]);
    expect(giveFish(p, 'dawn-chorus', 0).ok).toBe(false);
    expect(giveFish(withBag([fish('perch')]), 'dawn-chorus', 0).ok).toBe(false);
    expect(giveFish(p, 'nope', 0).ok).toBe(false);
    expect(giveFish(p, 'dawn-chorus', 9).ok).toBe(false);
  });
  it('takes the cheapest fitting fish and leaves the rest', () => {
    const p = withBag([fish('roach', 9), fish('roach', 4), fish('rudd', 1), fish('roach', 6)]);
    const r = giveFish(p, 'dawn-chorus', 0);
    expect(r.ok).toBe(true);
    expect(r.player.bag.map((f) => f.price)).toEqual([9, 1, 6]);
    expect(slotFilled(r.player, 'dawn-chorus', 0)).toBe(true);
    expect(r.finished).toBe(false);
    expect(r.player.coins).toBe(p.coins);
  });
  it('cannot fill a slot twice', () => {
    const r = giveFish(withBag([fish('roach'), fish('roach')]), 'dawn-chorus', 0);
    expect(giveFish(r.player, 'dawn-chorus', 0).ok).toBe(false);
  });
  it('cannot give into a coin slot', () => {
    expect(giveFish(withBag([fish('roach')]), 'petrol', 0).ok).toBe(false);
  });
  it('pays the reward once, when the bundle finishes', () => {
    let p = withBag([fish('roach'), fish('rudd'), fish('bleak')], { coins: 0 });
    p = giveFish(p, 'dawn-chorus', 0).player;
    p = giveFish(p, 'dawn-chorus', 1).player;
    expect(p.coins).toBe(0);
    const last = giveFish(p, 'dawn-chorus', 2);
    expect(last.finished).toBe(true);
    expect(last.reward?.coins).toBe(60);
    expect(last.player.coins).toBe(60);
    expect(last.player.baits?.corn).toBe(10);
    expect(bundleDone(last.player, 'dawn-chorus')).toBe(true);
    expect(giveFish(withBag([fish('roach')], last.player), 'dawn-chorus', 0).ok).toBe(false);
  });
  it('gold slots take gold fish only, cheapest first', () => {
    const p = withBag([fish('perch'), gold('carp', 90), gold('perch', 30)]);
    const r = giveFish(p, 'shiny-ones', 0);
    expect(r.ok).toBe(true);
    expect(r.player.bag.map((f) => f.price)).toEqual([10, 90]);
    expect(giveFish(withBag([fish('perch')]), 'shiny-ones', 0).ok).toBe(false);
  });
  it('duck tax pays worms', () => {
    const p = withBag([fish('bleak')], { worms: 3 });
    const r = giveFish(p, 'duck-tax', 0);
    expect(r.finished).toBe(true);
    expect(r.player.worms).toBe(8);
  });
});

describe('payCoins', () => {
  it('needs the coins and takes them', () => {
    expect(payCoins(withBag([], { coins: 499 }), 'petrol', 0).ok).toBe(false);
    const r = payCoins(withBag([], { coins: 520 }), 'petrol', 0);
    expect(r.ok).toBe(true);
    expect(r.player.coins).toBe(20);
    expect(r.finished).toBe(true);
    expect(bundleDone(r.player, 'petrol')).toBe(true);
  });
  it('refuses twice and on fish slots', () => {
    const r = payCoins(withBag([], { coins: 2000 }), 'petrol', 0);
    expect(payCoins(r.player, 'petrol', 0).ok).toBe(false);
    expect(payCoins(withBag([], { coins: 2000 }), 'dawn-chorus', 0).ok).toBe(false);
  });
});

describe('progress', () => {
  it('counts bundles and detects all done', () => {
    const p = newPlayer();
    expect(doneCount(p)).toBe(0);
    expect(allDone(p)).toBe(false);
    const almost = allButPetrol(p);
    expect(doneCount(almost)).toBe(5);
    expect(allDone(almost)).toBe(false);
    expect(allDone(payCoins({ ...almost, coins: 500 }, 'petrol', 0).player)).toBe(true);
  });
  it('canFill and fittingSlots reflect the bag', () => {
    const p = withBag([fish('bleak')]);
    expect(canFill(p, 'duck-tax', 0)).toBe(true);
    expect(canFill(p, 'dawn-chorus', 0)).toBe(false);
    expect(fittingSlots(p, fish('bleak')).map((s) => `${s.bundleId}:${s.slot}`)).toEqual(['dawn-chorus:2', 'duck-tax:0']);
    expect(fittingSlots(allButPetrol(p), fish('bleak'))).toEqual([]);
    expect(canFill(withBag([], { coins: 500 }), 'petrol', 0)).toBe(true);
    expect(canFill(withBag([], { coins: 10 }), 'petrol', 0)).toBe(false);
  });
  it('reward text', () => {
    expect(checklistRewardText(CHECKLIST[0].reward)).toBe('+10 corn · +60 coins');
    expect(checklistRewardText(CHECKLIST[1].reward)).toBe('+3 glow bait · +200 coins');
    expect(checklistRewardText(CHECKLIST[2].reward)).toBe('+10 fish strip · +150 coins');
    expect(checklistRewardText(CHECKLIST[4].reward)).toBe('+5 worms');
    expect(checklistRewardText(CHECKLIST[5].reward)).toBe('');
  });
});

describe('normalising', () => {
  it('fixes garbage', () => {
    for (const v of [undefined, null, 5, 'x', [], { a: 1 }]) {
      const s = normalizeChecklist(v);
      expect(Object.keys(s)).toHaveLength(6);
      expect(Object.values(s).every((a) => a.every((f) => !f))).toBe(true);
    }
    const s = normalizeChecklist({ ghost: [true], 'dawn-chorus': [true, 'yes', 1, true, true], 'duck-tax': 'x', petrol: [true] });
    expect(s.ghost).toBeUndefined();
    expect(s['dawn-chorus']).toEqual([true, false, false]);
    expect(s['duck-tax']).toEqual([false]);
    expect(s.petrol).toEqual([true]);
  });
  it('is stored only when something is filled, and survives a load', () => {
    expect('checklist' in normalizeSave({ version: 1, player: {} }).player).toBe(false);
    expect('checklist' in normalizeSave({ version: 1, player: { checklist: { ghost: [true] } } }).player).toBe(false);
    const p = normalizeSave({ version: 1, player: { checklist: { 'duck-tax': [true], ghost: [true] } } }).player;
    expect(p.checklist).toBeDefined();
    expect(Object.keys(p.checklist!)).not.toContain('ghost');
    expect(checklistOf(p)['duck-tax']).toEqual([true]);
  });
});

describe('panel order and warnings (slice 22b)', () => {
  it('lists unfinished bundles first and sinks finished ones', () => {
    const p = withBag([], { checklist: { 'dawn-chorus': [true, true, true] } });
    const ids = checklistOrder(p).map((b) => b.id);
    expect(ids[ids.length - 1]).toBe('dawn-chorus');
    expect(ids[0]).toBe('night-shift');
    expect(ids).toHaveLength(6);
  });
  it('opens the first bundle she can give to, else the first unfinished one' + ', else none', () => {
    expect(firstOpenBundle(withBag([]))).toBe('dawn-chorus');
    expect(firstOpenBundle(withBag([fish('eel')]))).toBe('night-shift');
    expect(firstOpenBundle(withBag([fish('bleak')], { checklist: { 'dawn-chorus': [true, true, false] } }))).toBe('dawn-chorus');
    const all = allButPetrol(withBag([]), true);
    expect(firstOpenBundle(all)).toBeUndefined();
  });
  it('warns when Give would take a gold fish or the fish of the day' + ', not otherwise', () => {
    expect(giveWarning(withBag([fish('roach')]), 'dawn-chorus', 0)).toBeUndefined();
    const g = giveWarning(withBag([gold('roach')]), 'dawn-chorus', 0);
    expect(g?.gold).toBe(true);
    expect(g?.text).toMatch(/^Gives your \d+ cm roach, a gold fish/);
    const f = giveWarning(withBag([fish('roach')]), 'dawn-chorus', 0, 'roach');
    expect(f?.fotd).toBe(true);
    expect(f?.text).toMatch(/fish of the day/);
    // The cheapest fitting fish is the one given: a plain roach in the bag means no warning.
    expect(giveWarning(withBag([gold('roach', 90), fish('roach', 5)]), 'dawn-chorus', 0)).toBeUndefined();
    expect(giveWarning(withBag([gold('roach')]), 'petrol', 0)).toBeUndefined();
  });
  it('says why a slot cannot be filled', () => {
    expect(slotBlockReason(withBag([]), 'dawn-chorus', 0)).toBe('not in bag');
    expect(slotBlockReason(withBag([fish('roach')]), 'dawn-chorus', 0)).toBeUndefined();
    expect(slotBlockReason(withBag([], { coins: 100 }), 'petrol', 0)).toBe('need 400 more');
  });
});

import { describe, expect, it } from 'vitest';
import { withBundlesDone } from './checklist/checklist';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { LURES, SPIN_ROD } from './data/spinning';
import { speciesById } from './data/fish';
import { QUIET_LAKE_STOCK, sold } from './data/shopStock';
import type { GameEvent } from './events';
import { knowledgeRows } from './fishKnowledge';
import { gateFor, gateText, gearOpenedBy, gearUnlocked } from './gearGates';
import {
  activeRig, addLure, applyEvent, buyLure, buySpinRod, canCast, chooseFloatRig, chooseLure, chosenLure, hasSpinRod, loseLure, lureCount, lureReturnsOf,
  newPlayer, ownedLures, takeLureReturn, type PlayerState,
} from './inventory';
import { applyCatchToPlayer, availableKinds, questText, questsOnCatch, rollDay, rollQuest, type CatchInfo, type QuestsState } from './quests/quests';
import { seededRng } from './random';
import { newSave, normalizeSave, parseSave, SAVE_KEY, writeSave } from './save';
import { decodeSaveCode, encodeSaveCode } from './saveCode';

const river = RIVER_BEND.shop;
const lake = QUIET_LAKE.shop;
const rich = (): PlayerState => ({ ...newPlayer(), coins: 100_000 });
const riverDone = (n: number, p: PlayerState = rich()) => withBundlesDone(p, n, 'river-bend');
const withRod = (p: PlayerState = rich()): PlayerState => ({ ...p, spinRod: true });
const fish = (over: Partial<Extract<GameEvent, { type: 'fishCaught' }>> = {}): GameEvent => ({ type: 'fishCaught', zone: 'shallow', pattern: 'smooth', difficulty: 0.2, fightMs: 9000, speciesId: 'chub', lengthCm: 30, weightG: 300, ...over });

describe('the spinning shop (slice 32)', () => {
  it('River bend sells the rod and the three lures in "River tackle" next to the float and the lead; Quiet Lake sells none of them', () => {
    for (const id of ['spinrod', 'spinner', 'wobbler', 'jig']) {
      expect(sold(river, id)).toBe(true);
      expect(river.gear).toContain(id);
      expect(sold(lake, id)).toBe(false);
    }
    expect(river.gearTitle).toBe('River tackle');
    // Quiet Lake's stock is pinned: nothing of the spinning gear ever joins it.
    expect(QUIET_LAKE_STOCK.gear).toEqual(QUIET_LAKE.shop.gear);
    expect([...lake.bait, ...lake.gear, ...lake.camp].some((id) => ['spinrod', 'spinner', 'wobbler', 'jig'].includes(id))).toBe(false);
  });

  it('the rod: 2500 coins, after one river bundle, once', () => {
    expect(gateFor('spinrod')).toMatchObject({ count: 1, place: 'river-bend' });
    expect(buySpinRod(rich(), river)).toMatchObject({ ok: false, error: 'locked' });
    expect(buySpinRod(riverDone(4, { ...rich(), coins: 100_000 }), lake)).toMatchObject({ ok: false, error: 'notSoldHere' });
    // The lake's bundles do not count.
    expect(buySpinRod(withBundlesDone(rich(), 4, 'quiet-lake'), river)).toMatchObject({ ok: false, error: 'locked' });
    expect(buySpinRod({ ...riverDone(1), coins: 2499 }, river)).toMatchObject({ ok: false, error: 'needCoins', missing: 1 });
    const r = buySpinRod(riverDone(1), river);
    expect(r.ok && r.state.coins).toBe(100_000 - SPIN_ROD.price);
    expect(r.ok && hasSpinRod(r.state)).toBe(true);
    expect(buySpinRod(riverDone(1, r.state), river)).toMatchObject({ ok: false, error: 'owned' });
  });

  it('the lures: 300, 600 and 450 coins; the spinner needs only the rod, the wobbler 2 river bundles, the jig 3', () => {
    expect(gateFor('spinner')).toBeUndefined();
    expect(gateFor('wobbler')).toMatchObject({ count: 2, place: 'river-bend' });
    expect(gateFor('jig')).toMatchObject({ count: 3, place: 'river-bend' });
    expect(gateText('wobbler', riverDone(1))).toBe('Unlocks after 2 river checklist bundles (1/2)');
    expect(gearUnlocked('spinner', rich())).toBe(true);
    // Not without the rod.
    expect(buyLure(rich(), 'spinner', river)).toMatchObject({ ok: false, error: 'needRod' });
    // The spinner: no bundle needed.
    const a = buyLure(withRod(), 'spinner', river);
    expect(a.ok && a.state.coins).toBe(100_000 - 300);
    expect(a.ok && lureCount(a.state, 'spinner')).toBe(1);
    expect(buyLure(withRod(), 'wobbler', river)).toMatchObject({ ok: false, error: 'locked' });
    expect(buyLure(withRod(), 'jig', river)).toMatchObject({ ok: false, error: 'locked' });
    const w = buyLure(withRod(riverDone(2)), 'wobbler', river);
    // withBundlesDone counts the river's bundles in order, and the 3rd (Ferry Fare, coins only) never counts: 4 finished = 3 counted.
    const j = buyLure(withRod(riverDone(4)), 'jig', river);
    expect(w.ok && w.state.coins).toBe(100_000 - 600);
    expect(j.ok && j.state.coins).toBe(100_000 - 450);
    expect(buyLure(withRod(riverDone(3)), 'jig', river)).toMatchObject({ ok: false, error: 'locked' });
  });

  it('lures are bought one at a time and kept until lost: a count per lure, any number of times', () => {
    let p = withRod();
    for (let i = 0; i < 3; i++) {
      const r = buyLure(p, 'spinner', river);
      expect(r.ok).toBe(true);
      p = r.state;
    }
    expect(lureCount(p, 'spinner')).toBe(3);
    expect(p.coins).toBe(100_000 - 900);
    expect(ownedLures(p).map((o) => [o.lure.id, o.count])).toEqual([['spinner', 3]]);
  });

  it('refusals leave the state alone: not sold at the lake, no coins, unknown lure', () => {
    const p = withRod(riverDone(4));
    for (const r of [buyLure(p, 'spinner', lake), buyLure(p, 'nope', river), buyLure({ ...p, coins: 10 }, 'spinner', river)]) expect(r.ok).toBe(false);
    expect(buyLure(p, 'spinner', lake).state).toBe(p);
    expect(buyLure({ ...p, coins: 250 }, 'spinner', river)).toMatchObject({ ok: false, error: 'needCoins', missing: 50 });
  });

  it('finishing a river bundle announces the rod and the lures it opened', () => {
    expect(gearOpenedBy('swift-water', riverDone(1))).toContain('spinrod');
  });
});

describe('the rig and the lure (slice 32)', () => {
  const kit = (): PlayerState => ({ ...withRod(), lures: { spinner: 2, jig: 1 } });

  it('the float is the rig until she picks a lure; picking a lure switches the rig', () => {
    expect(activeRig(kit())).toBe('float');
    const r = chooseLure(kit(), 'jig');
    expect(r.ok).toBe(true);
    expect(r.state.lure).toBe('jig');
    expect(activeRig(r.state)).toBe('spin');
    expect(chooseFloatRig(r.state).rig).toBeUndefined();
    expect(activeRig(chooseFloatRig(r.state))).toBe('float');
  });

  it('a lure she does not have, or no rod, cannot be chosen', () => {
    expect(chooseLure(kit(), 'wobbler')).toMatchObject({ ok: false });
    expect(chooseLure({ ...kit(), spinRod: undefined }, 'spinner')).toMatchObject({ ok: false });
  });

  it('the spinning rig needs the rod and a lure to cast: without them the float rig is used', () => {
    expect(activeRig({ ...kit(), rig: 'spin', spinRod: undefined })).toBe('float');
    expect(activeRig({ ...kit(), rig: 'spin', lures: undefined })).toBe('float');
    expect(activeRig({ ...kit(), rig: 'spin' })).toBe('spin');
  });

  it('the chosen lure falls back to one she has', () => {
    expect(chosenLure({ ...kit(), lure: 'jig' })).toBe('jig');
    expect(chosenLure({ ...kit(), lure: 'wobbler' })).toBe('spinner');
    expect(chosenLure(newPlayer())).toBeUndefined();
  });

  it('a spin cast needs no bait: she can cast with no worms at all', () => {
    const p: PlayerState = { ...kit(), worms: 0, rig: 'spin' };
    expect(canCast({ ...p, rig: undefined })).toBe(false);
    expect(canCast(p)).toBe(true);
  });

  it('a lure catch spends no bait and draws nothing from the rng; a float catch still does', () => {
    const p: PlayerState = { ...kit(), rig: 'spin', worms: 5 };
    const rng = () => {
      throw new Error('no rng draw expected');
    };
    expect(applyEvent(p, fish({ lure: 'spinner' }), rng)).toEqual({ state: p, wormUsed: false });
    expect(applyEvent(p, { type: 'fishLost', zone: 'shallow', pattern: 'smooth', difficulty: 0.2, speciesId: 'chub', lure: 'spinner' }, rng)).toEqual({ state: p, wormUsed: false });
    expect(applyEvent({ ...p, rig: undefined }, fish(), seededRng(1))).toMatchObject({ wormUsed: true, state: { worms: 4 } });
  });

  it('a lost lure leaves the count; the last one empties the record and the rig falls back to float', () => {
    let p: PlayerState = { ...kit(), rig: 'spin', lure: 'jig' };
    p = applyEvent(p, { type: 'lureLost', lure: 'jig', cause: 'snag', bringBack: false }, seededRng(1)).state;
    expect(lureCount(p, 'jig')).toBe(0);
    expect(p.lures).toEqual({ spinner: 2 });
    expect(chosenLure(p)).toBe('spinner');
    expect(p.lureReturns).toBeUndefined();
    p = loseLure(loseLure(p, 'spinner', false), 'spinner', false);
    expect(p.lures).toBeUndefined();
    expect(activeRig(p)).toBe('float');
    expect(loseLure(p, 'spinner', true)).toBe(p);
  });

  it('1 in 5 snap-lost lures wash up: the event queues the lure id; Bestia brings it back (oldest first)', () => {
    let p: PlayerState = kit();
    p = applyEvent(p, { type: 'lureLost', lure: 'spinner', cause: 'snapped', bringBack: true }, seededRng(1)).state;
    p = applyEvent(p, { type: 'lureLost', lure: 'jig', cause: 'snapped', bringBack: true }, seededRng(1)).state;
    expect(lureReturnsOf(p)).toEqual(['spinner', 'jig']);
    expect(lureCount(p, 'spinner')).toBe(1);
    const a = takeLureReturn(p);
    expect(a.lure).toBe('spinner');
    expect(lureCount(a.state, 'spinner')).toBe(2);
    expect(lureReturnsOf(a.state)).toEqual(['jig']);
    const b = takeLureReturn(a.state);
    expect(b.lure).toBe('jig');
    expect(b.state.lureReturns).toBeUndefined();
    expect(takeLureReturn(b.state)).toEqual({ state: b.state });
  });

  it('a snag never queues a bring-back', () => {
    const p = applyEvent(kit(), { type: 'lureLost', lure: 'spinner', cause: 'snag', bringBack: false }, seededRng(1)).state;
    expect(lureReturnsOf(p)).toEqual([]);
  });

  it('addLure ignores unknown ids and n <= 0', () => {
    const p = kit();
    expect(addLure(p, 'nope', 1)).toBe(p);
    expect(addLure(p, 'spinner', 0)).toBe(p);
    expect(lureCount(addLure(p, 'wobbler', 2), 'wobbler')).toBe(2);
  });
});

describe('the save (slice 32)', () => {
  const owned: PlayerState = { ...newPlayer(), spinRod: true, lures: { spinner: 3, wobbler: 1, jig: 2 }, rig: 'spin', lure: 'wobbler', lureReturns: ['jig', 'spinner'] };

  it('round-trips through the JSON text and normalisation', () => {
    const save = { ...newSave(), player: owned };
    const r = parseSave(JSON.stringify(save));
    expect(r.ok && r.save.player).toEqual(owned);
  });

  it('round-trips through the export code', () => {
    const code = encodeSaveCode({ ...newSave(), player: owned }, { player: 'A', companion: 'B', dog: 'C' });
    const r = decodeSaveCode(code);
    expect(r.ok && r.save.player).toEqual(owned);
    expect(r.ok && r.save.player.spinRod).toBe(true);
    expect(r.ok && r.save.player.lures).toEqual({ spinner: 3, wobbler: 1, jig: 2 });
    expect(r.ok && r.save.player.lureReturns).toEqual(['jig', 'spinner']);
  });

  it('round-trips through storage', () => {
    const data: Record<string, string> = {};
    expect(writeSave({ setItem: (k, v) => void (data[k] = v) }, { ...newSave(), player: owned })).toBe(true);
    const r = parseSave(data[SAVE_KEY]);
    expect(r.ok && r.save.player.lures).toEqual(owned.lures);
  });

  it('an old save has none of the keys, and a fresh one stores none', () => {
    const p = normalizeSave({ version: 1, player: { coins: 5 }, clock: {} }).player;
    for (const k of ['spinRod', 'lures', 'rig', 'lure', 'lureReturns']) expect(p).not.toHaveProperty(k);
    expect(Object.keys(newPlayer())).not.toContain('lures');
  });

  it('normalises: unknown ids dropped, negatives and junk clamped, huge counts capped', () => {
    const p = normalizeSave({
      version: 1,
      player: {
        coins: 5,
        spinRod: 'yes',
        lures: { spinner: -4, wobbler: 2.9, jig: 1e9, flail: 3, nope: 'x' },
        rig: 'rocket',
        lure: 'flail',
        lureReturns: ['jig', 'flail', 7, 'spinner'],
      },
      clock: {},
    }).player;
    expect(p.spinRod).toBeUndefined();
    expect(p.lures).toEqual({ wobbler: 2, jig: 9999 });
    expect(p.rig).toBeUndefined();
    expect(p.lure).toBeUndefined();
    expect(p.lureReturns).toEqual(['jig', 'spinner']);
    // Garbage shapes.
    const q = normalizeSave({ version: 1, player: { lures: [1, 2], lureReturns: 'jig', rig: 'spin', spinRod: true } }).player;
    expect(q.lures).toBeUndefined();
    expect(q.lureReturns).toBeUndefined();
    expect(q.rig).toBe('spin');
    expect(q.spinRod).toBe(true);
    // At most 20 waiting.
    expect(normalizeSave({ version: 1, player: { lureReturns: Array(50).fill('jig') } }).player.lureReturns).toHaveLength(20);
  });
});

describe('the fish log row and the quest (slice 32)', () => {
  const sp = (id: string) => speciesById(id)!;

  it('once the rod is owned a predator learns its favourite lure with the favourite bait (10 catches)', () => {
    const rows = (id: string, n: number, withLures = true) => knowledgeRows(sp(id), n, withLures);
    expect(rows('pike', 10).find((r) => r.kind === 'lure')).toMatchObject({ text: 'Likes: soft jig', lureIds: ['jig'], unlocked: true, need: 10 });
    expect(rows('trout', 10).find((r) => r.kind === 'lure')?.text).toBe('Likes: spinner, wobbler');
    expect(rows('chub', 12).find((r) => r.kind === 'lure')?.text).toBe('Likes: wobbler');
    expect(rows('pike', 9).some((r) => r.kind === 'lure')).toBe(false); // hidden until learned, like the weather row
    // A peaceful fish has none; no rod = no row; old callers see the same rows as before.
    expect(rows('roach', 40).some((r) => r.kind === 'lure')).toBe(false);
    expect(rows('pike', 40, false).some((r) => r.kind === 'lure')).toBe(false);
    expect(knowledgeRows(sp('pike'), 40).map((r) => r.kind)).toEqual(knowledgeRows(sp('pike'), 40, false).map((r) => r.kind));
    // The trophies have no rows at all.
    expect(knowledgeRows(sp('ferryPike'), 40, true)).toEqual([]);
  });

  it('"Catch a predator on a lure" rolls only once the rod is owned', () => {
    expect(availableKinds(newPlayer())).not.toContain('catchOnLure');
    expect(availableKinds({ ...newPlayer(), spinRod: true })).toContain('catchOnLure');
    // Without the rod no day ever rolls it; with the rod some days do.
    const days = Array.from({ length: 200 }, (_, i) => new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10));
    expect(days.some((d) => rollDay(d, newPlayer()).some((q) => q.kind === 'catchOnLure'))).toBe(false);
    expect(days.some((d) => rollDay(d, { ...newPlayer(), spinRod: true }).some((q) => q.kind === 'catchOnLure'))).toBe(true);
  });

  it('its text and target, and only a lure catch counts', () => {
    const q = rollQuest('catchOnLure', { ...newPlayer(), spinRod: true }, seededRng(3));
    expect(q.params.target).toBeGreaterThanOrEqual(1);
    expect(q.params.target).toBeLessThanOrEqual(3);
    expect(questText({ ...q, params: { target: 1 } })).toBe('Catch a predator on a lure');
    expect(questText({ ...q, params: { target: 3 } })).toBe('Catch 3 predators on a lure');
    const board: QuestsState = { date: '2027-01-01', rerollUsed: false, list: [{ ...q, params: { target: 2 }, progress: 0, done: false, claimed: false }] };
    const info: CatchInfo = { speciesId: 'asp', zone: 'shallow', timeOfDay: 'day', isRecord: false };
    expect(questsOnCatch(board, info).quests.list[0].progress).toBe(0);
    expect(questsOnCatch(board, { ...info, lure: true }).quests.list[0].progress).toBe(1);
    const p = applyCatchToPlayer({ ...newPlayer(), quests: board }, { ...info, lure: true });
    expect(p.player.quests?.list[0].progress).toBe(1);
  });

  it('a saved lure quest survives the save, a forged kind does not', () => {
    const q = rollQuest('catchOnLure', { ...newPlayer(), spinRod: true }, seededRng(3));
    const p = normalizeSave({ version: 1, player: { quests: { date: '2027-01-01', rerollUsed: false, list: [q] } }, clock: {} }).player;
    expect(p.quests?.list[0].kind).toBe('catchOnLure');
    const bad = normalizeSave({ version: 1, player: { quests: { date: '2027-01-01', rerollUsed: false, list: [{ ...q, kind: 'catchOnRocket' }] } }, clock: {} }).player;
    expect(bad.quests?.list[0]?.kind).not.toBe('catchOnRocket');
  });
});

describe('the lures list', () => {
  it('has the three lures with their gates', () => {
    expect(LURES.map((l) => l.id)).toEqual(['spinner', 'wobbler', 'jig']);
    expect(LURES.map((l) => l.bundles)).toEqual([0, 2, 3]);
  });
});

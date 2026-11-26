import { describe, expect, it } from 'vitest';
import { QUEST_TUNING } from '../data/quests';
import { speciesById } from '../data/fish';
import { newPlayer, sellAll, sellOne, toBagFish, type PlayerState } from '../inventory';
import {
  availableKinds,
  canReroll,
  claimQuest,
  claimableCount,
  hashString,
  newQuests,
  questText,
  questsOf,
  questsOnCatch,
  questsOnSale,
  rerollQuest,
  rewardText,
  rollDay,
  syncQuests,
  type CatchInfo,
  type Quest,
  type QuestKind,
  type QuestsState,
} from './quests';

const TODAY = '2026-11-23';
const logOf = (n: number): PlayerState['log'] => {
  const ids = ['roach', 'rudd', 'bleak', 'perch', 'crucian', 'eel', 'bream'];
  return Object.fromEntries(ids.slice(0, n).map((id) => [id, { count: 2, bestLengthCm: 15, bestWeightG: 100 }]));
};
const withRod = (rodId: string, species = 0): PlayerState => ({ ...newPlayer(), rodId, log: logOf(species) });
const kindsOf = (list: Quest[]): QuestKind[] => list.map((q) => q.kind);
const quest = (kind: QuestKind, params: Quest['params'], extra: Partial<Quest> = {}): Quest => ({
  kind, params, progress: 0, done: false, claimed: false, reward: { coins: 30, worms: 4 }, ...extra,
});
const board = (list: Quest[], extra: Partial<QuestsState> = {}): QuestsState => ({ date: TODAY, rerollUsed: false, list, ...extra });
const caught = (over: Partial<CatchInfo> = {}): CatchInfo => ({ speciesId: 'roach', zone: 'shallow', timeOfDay: 'day', isRecord: false, ...over });
const addDays = (d: string, n: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dates = Array.from({ length: 120 }, (_, i) => addDays('2026-01-01', i));

describe('hashString', () => {
  it('is stable and spreads different dates apart', () => {
    expect(hashString('2026-11-23')).toBe(hashString('2026-11-23'));
    expect(new Set(dates.map(hashString)).size).toBe(dates.length);
  });
});

describe('rollDay', () => {
  it('gives the same quests for the same day and gear', () => {
    expect(rollDay(TODAY, withRod('carbon', 5))).toEqual(rollDay(TODAY, withRod('carbon', 5)));
  });
  it('differs between days', () => {
    const lists = new Set(dates.map((d) => JSON.stringify(rollDay(d, newPlayer()))));
    expect(lists.size).toBeGreaterThan(100);
  });
  it('always has three quests of three different kinds, fresh and unpaid', () => {
    for (const rod of ['bamboo', 'fiberglass', 'carbon']) {
      for (const species of [0, 2, 5]) {
        for (const d of dates) {
          const list = rollDay(d, withRod(rod, species));
          expect(list).toHaveLength(QUEST_TUNING.perDay);
          expect(new Set(kindsOf(list)).size).toBe(3);
          for (const q of list) expect(q).toMatchObject({ progress: 0, done: false, claimed: false });
        }
      }
    }
  });
  it('asks for no deep water and no deep species with the bamboo rod', () => {
    for (const d of dates) {
      const list = rollDay(d, withRod('bamboo', 6));
      expect(kindsOf(list)).not.toContain('catchDeep');
      for (const q of list) if (q.kind === 'catchSpecies') expect(speciesById(q.params.speciesId!)!.zone).toBe('shallow');
    }
  });
  it('can ask for deep water and deep species with a deeper rod', () => {
    const all = dates.flatMap((d) => rollDay(d, withRod('fiberglass', 6)));
    expect(kindsOf(all)).toContain('catchDeep');
    expect(all.some((q) => q.kind === 'catchSpecies' && speciesById(q.params.speciesId!)!.zone === 'deep')).toBe(true);
    expect(all.some((q) => q.kind === 'catchSpecies' && speciesById(q.params.speciesId!)!.zone === 'shallow')).toBe(true);
  });
  it('never targets the Pale One', () => {
    for (const d of dates) for (const q of rollDay(d, withRod('carbon', 6))) expect(q.params.speciesId).not.toBe('pale');
  });
  it('asks to beat a record only with at least three species in the log', () => {
    for (const d of dates) expect(kindsOf(rollDay(d, withRod('carbon', 2)))).not.toContain('beatRecord');
    expect(dates.some((d) => kindsOf(rollDay(d, withRod('carbon', 3))).includes('beatRecord'))).toBe(true);
  });
  it('keeps targets and rewards inside the tuned ranges', () => {
    for (const d of dates) {
      for (const q of rollDay(d, withRod('carbon', 6))) {
        expect(q.params.target).toBeGreaterThanOrEqual(1);
        expect(q.reward.coins).toBeGreaterThanOrEqual(20);
        expect(q.reward.coins).toBeLessThanOrEqual(60);
        expect(q.reward.worms).toBeGreaterThanOrEqual(3);
        expect(q.reward.worms).toBeLessThanOrEqual(6);
        if (q.kind === 'catchAny') expect(q.params.target).toBeGreaterThanOrEqual(QUEST_TUNING.catchAny[0]);
        if (q.kind === 'catchAtTime') expect(['dawn', 'dusk', 'night']).toContain(q.params.timeOfDay);
        if (q.kind === 'catchSpecies') {
          const [lo, hi] = QUEST_TUNING.catchSpecies[speciesById(q.params.speciesId!)!.rarity as 'common'];
          expect(q.params.target).toBeGreaterThanOrEqual(lo);
          expect(q.params.target).toBeLessThanOrEqual(hi);
        }
      }
    }
  });
  it('pays more for the harder end of a range', () => {
    const rewards = (k: QuestKind) => dates.flatMap((d) => rollDay(d, withRod('carbon', 6))).filter((q) => q.kind === k);
    const any = rewards('catchAny');
    const low = any.filter((q) => q.params.target <= 13);
    const high = any.filter((q) => q.params.target >= 21);
    expect(Math.max(...low.map((q) => q.reward.coins))).toBeLessThan(Math.min(...high.map((q) => q.reward.coins)) + 1);
    expect(Math.min(...high.map((q) => q.reward.coins))).toBeGreaterThan(Math.min(...low.map((q) => q.reward.coins)));
  });
  it('scales sell targets to the rod', () => {
    const sells = (rod: string) => dates.flatMap((d) => rollDay(d, withRod(rod, 6))).filter((q) => q.kind === 'sellCoins');
    expect(Math.max(...sells('bamboo').map((q) => q.params.target))).toBeLessThanOrEqual(QUEST_TUNING.sellCoins.shallowRod[1]);
    expect(Math.min(...sells('carbon').map((q) => q.params.target))).toBeGreaterThanOrEqual(QUEST_TUNING.sellCoins.deepRod[0]);
  });
});

describe('availableKinds', () => {
  it('follows the gear and the log', () => {
    expect(availableKinds(withRod('bamboo', 0)).sort()).toEqual(['catchAny', 'catchAtTime', 'catchSpecies', 'sellCoins']);
    expect(availableKinds(withRod('carbon', 3))).toHaveLength(6);
  });
});

describe('syncQuests', () => {
  it('rolls the first day', () => {
    const r = syncQuests(newPlayer(), TODAY);
    expect(r.rolled).toBe(true);
    expect(r.paid).toBeNull();
    expect(r.player.quests!.date).toBe(TODAY);
    expect(r.player.quests!.list).toHaveLength(3);
    expect(r.player.quests!.rerollUsed).toBe(false);
  });
  it('does nothing on the same day, and returns the very same object', () => {
    const p = syncQuests(newPlayer(), TODAY).player;
    const again = syncQuests(p, TODAY);
    expect(again.rolled).toBe(false);
    expect(again.player).toBe(p);
  });
  it('freezes the list for the day even when a better rod is bought', () => {
    const p = syncQuests(newPlayer(), TODAY).player;
    const richer = { ...p, rodId: 'carbon', log: logOf(7) };
    expect(syncQuests(richer, TODAY).player.quests).toEqual(p.quests);
  });
  it('rolls a new list on a later day with a fresh reroll, and pays done-but-unclaimed quests first', () => {
    const p0 = syncQuests({ ...newPlayer(), coins: 10, worms: 1 }, TODAY).player;
    const list = [
      { ...p0.quests!.list[0], done: true, progress: p0.quests!.list[0].params.target, claimed: false, reward: { coins: 30, worms: 4 } },
      { ...p0.quests!.list[1], done: true, progress: p0.quests!.list[1].params.target, claimed: true, reward: { coins: 99, worms: 9 } },
      { ...p0.quests!.list[2], reward: { coins: 77, worms: 7 } },
    ];
    const p1 = { ...p0, quests: { ...p0.quests!, rerollUsed: true, list } };
    const r = syncQuests(p1, addDays(TODAY, 1));
    expect(r.rolled).toBe(true);
    expect(r.paid).toMatchObject({ coins: 30, worms: 4 });
    expect(r.player.coins).toBe(40);
    expect(r.player.worms).toBe(5);
    expect(r.player.quests!.date).toBe(addDays(TODAY, 1));
    expect(r.player.quests!.rerollUsed).toBe(false);
    expect(r.player.quests!.list.every((q) => !q.done && !q.claimed)).toBe(true);
  });
  it('rolls the new day with the gear owned at that moment', () => {
    const p0 = syncQuests(newPlayer(), TODAY).player;
    const next = syncQuests({ ...p0, rodId: 'carbon', log: logOf(7) }, addDays(TODAY, 1)).player.quests!.list;
    expect(next).toEqual(rollDay(addDays(TODAY, 1), { ...p0, rodId: 'carbon', log: logOf(7) }));
  });
  it('keeps everything when the clock was set back, never paying or rerolling', () => {
    const p0 = syncQuests({ ...newPlayer(), coins: 5 }, TODAY).player;
    const done = { ...p0, quests: { ...p0.quests!, list: p0.quests!.list.map((q) => ({ ...q, done: true, progress: q.params.target })) } };
    const r = syncQuests(done, addDays(TODAY, -3));
    expect(r.rolled).toBe(false);
    expect(r.paid).toBeNull();
    expect(r.player).toBe(done);
  });
  it('ignores an invalid date', () => {
    const p = newPlayer();
    expect(syncQuests(p, 'nonsense').player).toBe(p);
    expect(syncQuests(p, '2026-02-30').rolled).toBe(false);
  });
  it('treats a player without a quests field as an empty board', () => {
    const { quests: _q, ...old } = newPlayer();
    expect(questsOf(old as PlayerState)).toEqual(newQuests());
    expect(syncQuests(old as PlayerState, TODAY).player.quests!.list).toHaveLength(3);
  });
});

describe('questsOnCatch', () => {
  it('catchSpecies counts only that species', () => {
    const q = board([quest('catchSpecies', { target: 2, speciesId: 'roach' })]);
    expect(questsOnCatch(q, caught({ speciesId: 'rudd' })).quests).toBe(q);
    const one = questsOnCatch(q, caught());
    expect(one.quests.list[0].progress).toBe(1);
    expect(one.completed).toEqual([]);
    const two = questsOnCatch(one.quests, caught());
    expect(two.quests.list[0]).toMatchObject({ progress: 2, done: true });
    expect(two.completed).toEqual([0]);
  });
  it('catchAny counts every fish, the Pale One too', () => {
    const q = board([quest('catchAny', { target: 2 })]);
    const r = questsOnCatch(questsOnCatch(q, caught()).quests, caught({ speciesId: 'pale', zone: 'deep', timeOfDay: 'night' }));
    expect(r.quests.list[0].done).toBe(true);
  });
  it('catchAtTime counts the matching period only', () => {
    const q = board([quest('catchAtTime', { target: 1, timeOfDay: 'dusk' })]);
    for (const t of ['dawn', 'day', 'night'] as const) expect(questsOnCatch(q, caught({ timeOfDay: t })).quests).toBe(q);
    expect(questsOnCatch(q, caught({ timeOfDay: 'dusk' })).quests.list[0].done).toBe(true);
  });
  it('catchDeep counts deep water only', () => {
    const q = board([quest('catchDeep', { target: 2 })]);
    expect(questsOnCatch(q, caught({ zone: 'shallow' })).quests).toBe(q);
    expect(questsOnCatch(q, caught({ zone: 'deep', speciesId: 'carp' })).quests.list[0].progress).toBe(1);
    expect(questsOnCatch(q, caught({ zone: 'deep', speciesId: 'pale' })).quests.list[0].progress).toBe(1);
  });
  it('beatRecord counts a record, not a first catch or a plain catch, and not a Pale One rematch', () => {
    const q = board([quest('beatRecord', { target: 1 })]);
    expect(questsOnCatch(q, caught({ isRecord: false })).quests).toBe(q);
    expect(questsOnCatch(q, caught({ isRecord: true, speciesId: 'pale', zone: 'deep' })).quests).toBe(q);
    expect(questsOnCatch(q, caught({ isRecord: true })).quests.list[0].done).toBe(true);
  });
  it('one catch advances several quests, and a done quest stays put', () => {
    const q = board([quest('catchAny', { target: 1 }), quest('catchSpecies', { target: 3, speciesId: 'roach' }), quest('sellCoins', { target: 50 })]);
    const r = questsOnCatch(q, caught());
    expect(r.quests.list.map((x) => x.progress)).toEqual([1, 1, 0]);
    expect(r.completed).toEqual([0]);
    const again = questsOnCatch(r.quests, caught());
    expect(again.quests.list[0].progress).toBe(1);
    expect(again.completed).toEqual([]);
  });
  it('does not mutate the input', () => {
    const q = board([quest('catchAny', { target: 2 })]);
    const snapshot = JSON.stringify(q);
    questsOnCatch(q, caught());
    expect(JSON.stringify(q)).toBe(snapshot);
  });
});

describe('questsOnSale', () => {
  it('adds the coins up and completes at the target', () => {
    const q = board([quest('sellCoins', { target: 100 }), quest('catchAny', { target: 5 })]);
    const a = questsOnSale(q, 60);
    expect(a.quests.list[0]).toMatchObject({ progress: 60, done: false });
    expect(a.quests.list[1].progress).toBe(0);
    const b = questsOnSale(a.quests, 70);
    expect(b.quests.list[0]).toMatchObject({ progress: 100, done: true });
    expect(b.completed).toEqual([0]);
  });
  it('ignores zero and negative sales', () => {
    const q = board([quest('sellCoins', { target: 100 })]);
    expect(questsOnSale(q, 0).quests).toBe(q);
    expect(questsOnSale(q, -5).quests).toBe(q);
  });
  it('is fed by the real sell functions', () => {
    const price = toBagFish({ speciesId: 'carp', lengthCm: 60, weightG: 3000 }).price;
    const p: PlayerState = {
      ...newPlayer(),
      bag: [toBagFish({ speciesId: 'carp', lengthCm: 60, weightG: 3000 }), toBagFish({ speciesId: 'carp', lengthCm: 60, weightG: 3000 })],
      quests: board([quest('sellCoins', { target: price * 2 })]),
    };
    const one = sellOne(p, 0);
    expect(one.ok && one.state.quests!.list[0].progress).toBe(price);
    const all = sellAll(p);
    expect(all.ok && all.state.quests!.list[0]).toMatchObject({ progress: price * 2, done: true });
  });
});

describe('claimQuest', () => {
  const done = quest('catchAny', { target: 3 }, { progress: 3, done: true, reward: { coins: 30, worms: 4 } });
  const base: PlayerState = { ...newPlayer(), coins: 5, worms: 2, quests: board([done, quest('catchDeep', { target: 2 })]) };
  it('pays a finished quest once', () => {
    const r = claimQuest(base, 0);
    expect(r.paid).toMatchObject({ coins: 30, worms: 4 });
    expect(r.player.coins).toBe(35);
    expect(r.player.worms).toBe(6);
    expect(r.player.quests!.list[0].claimed).toBe(true);
    const again = claimQuest(r.player, 0);
    expect(again.paid).toBeNull();
    expect(again.player).toBe(r.player);
  });
  it('does nothing for an unfinished quest or a bad index', () => {
    expect(claimQuest(base, 1).paid).toBeNull();
    expect(claimQuest(base, 1).player).toBe(base);
    expect(claimQuest(base, 7).player).toBe(base);
    expect(claimQuest(base, -1).player).toBe(base);
  });
  it('drives the badge count', () => {
    expect(claimableCount(base.quests!)).toBe(1);
    expect(claimableCount(claimQuest(base, 0).player.quests!)).toBe(0);
  });
});

describe('rerollQuest', () => {
  const start = (rod = 'carbon', species = 6): PlayerState => syncQuests(withRod(rod, species), TODAY).player;
  it('replaces an unfinished quest with a different kind, once a day', () => {
    const p = start();
    const before = kindsOf(p.quests!.list);
    const r = rerollQuest(p, 1, TODAY);
    expect(r.ok).toBe(true);
    const after = r.player.quests!.list;
    expect(r.player.quests!.rerollUsed).toBe(true);
    expect(before).not.toContain(after[1].kind);
    expect(new Set(kindsOf(after)).size).toBe(3);
    expect(after[0]).toEqual(p.quests!.list[0]);
    expect(after[2]).toEqual(p.quests!.list[2]);
    expect(after[1]).toMatchObject({ progress: 0, done: false, claimed: false });
    const second = rerollQuest(r.player, 0, TODAY);
    expect(second.ok).toBe(false);
    expect(second.player).toBe(r.player);
  });
  it('is deterministic for the same day and slot', () => {
    expect(rerollQuest(start(), 2, TODAY).player).toEqual(rerollQuest(start(), 2, TODAY).player);
  });
  it('respects the gear: no deep quest for a bamboo rod', () => {
    for (const d of dates) {
      const p = syncQuests(withRod('bamboo', 0), d).player;
      const r = rerollQuest(p, 0, d);
      if (r.ok) expect(r.player.quests!.list[0].kind).not.toBe('catchDeep');
    }
  });
  it('never rerolls a finished quest or a stale list, and spends nothing on a refusal', () => {
    const p = start();
    const doneP = { ...p, quests: { ...p.quests!, list: p.quests!.list.map((q, i) => (i === 0 ? { ...q, done: true, progress: q.params.target } : q)) } };
    expect(rerollQuest(doneP, 0, TODAY).ok).toBe(false);
    expect(rerollQuest(doneP, 0, TODAY).player).toBe(doneP);
    expect(rerollQuest(p, 0, addDays(TODAY, 1)).ok).toBe(false);
    expect(rerollQuest(p, 5, TODAY).ok).toBe(false);
    expect(canReroll(p.quests!, 0, TODAY)).toBe(true);
    expect(canReroll({ ...p.quests!, rerollUsed: true }, 0, TODAY)).toBe(false);
  });
  it('fails when every available kind is already on the board', () => {
    const p = syncQuests(withRod('bamboo', 0), TODAY).player; // four kinds are possible with this gear
    expect(rerollQuest(p, 0, TODAY).ok).toBe(true);
    const full = { ...p, quests: board([quest('catchSpecies', { target: 3, speciesId: 'roach' }), quest('catchAny', { target: 12 }), quest('catchAtTime', { target: 1, timeOfDay: 'dawn' }), quest('sellCoins', { target: 60 })]) };
    const r = rerollQuest(full, 0, TODAY);
    expect(r.ok).toBe(false);
    expect(r.player).toBe(full);
  });
});

describe('words', () => {
  it('reads like the design doc', () => {
    expect(questText(quest('catchSpecies', { target: 3, speciesId: 'roach' }))).toBe('Catch 3 roach');
    expect(questText(quest('catchSpecies', { target: 1, speciesId: 'perch' }))).toBe('Catch a perch');
    expect(questText(quest('catchAny', { target: 12 }))).toBe('Catch 12 fish');
    expect(questText(quest('catchAtTime', { target: 1, timeOfDay: 'dusk' }))).toBe('Catch a fish at dusk');
    expect(questText(quest('catchAtTime', { target: 3, timeOfDay: 'night' }))).toBe('Catch 3 fish at night');
    expect(questText(quest('catchDeep', { target: 3 }))).toBe('Catch 3 fish in deep water');
    expect(questText(quest('sellCoins', { target: 100 }))).toBe('Sell fish for 100 coins');
    expect(questText(quest('beatRecord', { target: 1 }))).toBe('Beat a personal best');
    expect(rewardText({ coins: 30, worms: 4 })).toBe('+30 coins · +4 worms');
  });
});

describe('species quest grammar', () => {
  const POOL = ['roach', 'rudd', 'bleak', 'perch', 'crucian', 'eel', 'ide', 'asp', 'bream', 'tench', 'carp', 'pike', 'zander', 'burbot', 'catfish'];
  it('uses a / an by the first letter', () => {
    expect(questText(quest('catchSpecies', { target: 1, speciesId: 'eel' }))).toBe('Catch an eel');
    expect(questText(quest('catchSpecies', { target: 1, speciesId: 'ide' }))).toBe('Catch an ide');
    expect(questText(quest('catchSpecies', { target: 1, speciesId: 'asp' }))).toBe('Catch an asp');
    expect(questText(quest('catchSpecies', { target: 1, speciesId: 'crucian' }))).toBe('Catch a crucian carp');
  });
  it('pluralises eel and ide, the rest stay the same', () => {
    expect(questText(quest('catchSpecies', { target: 2, speciesId: 'eel' }))).toBe('Catch 2 eels');
    expect(questText(quest('catchSpecies', { target: 3, speciesId: 'ide' }))).toBe('Catch 3 ides');
    for (const id of ['pike', 'bream', 'roach', 'carp', 'perch', 'asp', 'burbot', 'tench', 'crucian', 'zander', 'catfish', 'rudd', 'bleak']) {
      const name = speciesById(id)!.name.toLowerCase();
      expect(questText(quest('catchSpecies', { target: 2, speciesId: id }))).toBe(`Catch 2 ${name}`);
    }
  });
  it('has no "a" before a vowel for any pool species', () => {
    for (const id of POOL) {
      expect(speciesById(id), id).toBeDefined();
      expect(questText(quest('catchSpecies', { target: 1, speciesId: id }))).not.toMatch(/Catch a [aeiou]/);
    }
  });
});

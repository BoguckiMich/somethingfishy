import { describe, expect, it } from 'vitest';
import { BAITS, SHOP_BAITS, WORM_ID, baitById } from './data/baits';
import { STARTER_BAR_GEAR } from './data/barGear';
import { POOL_SPECIES } from './data/fish';
import { QUIET_LAKE } from './data/locations';
import { RODS } from './data/rods';
import { glowChance, openBox, rollContents } from './daily/daily';
import type { GameEvent } from './events';
import { candidates, pickSpecies, rollHookedFish, spawnWeight } from './fish';
import { INITIAL_STATE, firstWaitFactor, step, type FishingInput, type SessionContext } from './fishingSession';
import { CHARGE_HALF_CYCLE_MS } from './casting';
import {
  addBait,
  applyEvent,
  baitCount,
  buyBait,
  canCast,
  chooseBait,
  chosenBait,
  freeWormsIfStuck,
  newPlayer,
  ownedBaits,
  type PlayerState,
} from './inventory';
import { seededRng } from './random';
import { normalizeSave } from './save';
import { QUEST_TUNING } from './data/quests';
import { claimQuest, rewardText, rollDay, syncQuests, type Quest } from './quests/quests';

const share = (id: string, zone: 'shallow' | 'deep', time: 'dawn' | 'day' | 'dusk' | 'night', bait: string | undefined, seed = 7, n = 6000) => {
  const rng = seededRng(seed);
  let hits = 0;
  for (let i = 0; i < n; i++) if (pickSpecies(zone, time, rng, bait).id === id) hits++;
  return hits / n;
};

describe('bait data', () => {
  it('has the four special baits with unique ids, effects and prices below the fish they attract', () => {
    expect(BAITS.map((b) => b.id)).toEqual(['corn', 'maggots', 'strip', 'glow']);
    expect(new Set(BAITS.map((b) => b.id)).size).toBe(BAITS.length);
    expect(SHOP_BAITS.map((b) => b.id)).toEqual(['corn', 'maggots', 'strip']);
    expect(baitById('glow')?.pack).toBeUndefined();
    expect(baitById(WORM_ID)).toBeUndefined(); // worms are not a special bait
    for (const b of BAITS) expect(b.effect[0]).toBe(b.effect[0].toUpperCase());
    for (const b of SHOP_BAITS) {
      const each = b.pack!.price / b.pack!.size;
      const prices = POOL_SPECIES.filter((s) => b.speciesBoost?.ids.includes(s.id)).map((s) => s.basePrice);
      if (prices.length) expect(each).toBeLessThan(Math.min(...prices.filter((p) => p >= 20)) / 2);
    }
  });
});

describe('spawn weights', () => {
  it('no bait and worms are the plain pick (same seed, same fish)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const a = pickSpecies('deep', 'day', seededRng(seed));
      expect(pickSpecies('deep', 'day', seededRng(seed), undefined).id).toBe(a.id);
      expect(pickSpecies('deep', 'day', seededRng(seed), WORM_ID).id).toBe(a.id);
    }
  });

  it('corn raises the carp share in deep water by day and never lowers it', () => {
    const plain = share('carp', 'deep', 'day', undefined);
    const corn = share('carp', 'deep', 'day', 'corn');
    // Bream is boosted too, so the carp's own share grows less than x3: 30/120 -> 90/300.
    expect(plain).toBeCloseTo(0.25, 1);
    expect(corn).toBeCloseTo(0.3, 1);
    expect(corn).toBeGreaterThan(plain * 1.1);
    // The corn species together take the lion's share: 90/120 -> 270/300.
    const both = (bait?: string) => share('carp', 'deep', 'day', bait) + share('bream', 'deep', 'day', bait);
    expect(both('corn')).toBeGreaterThan(both() + 0.1);
  });

  it('strip raises pike by day and glow raises the rare catfish at night', () => {
    expect(share('pike', 'deep', 'day', 'strip')).toBeGreaterThan(share('pike', 'deep', 'day', undefined) * 1.5);
    expect(share('catfish', 'deep', 'night', 'glow')).toBeGreaterThan(share('catfish', 'deep', 'night', undefined) * 2);
  });

  it('the weight maths: x3 for the listed species or rarity only', () => {
    const carp = POOL_SPECIES.find((s) => s.id === 'carp')!;
    const pike = POOL_SPECIES.find((s) => s.id === 'pike')!;
    expect(spawnWeight(carp, 'corn')).toBe(spawnWeight(carp) * 3);
    expect(spawnWeight(pike, 'corn')).toBe(spawnWeight(pike));
    expect(spawnWeight(pike, 'strip')).toBe(spawnWeight(pike) * 3);
    expect(spawnWeight(pike, 'glow')).toBe(spawnWeight(pike)); // uncommon
    expect(spawnWeight(carp, 'maggots')).toBe(spawnWeight(carp));
    expect(spawnWeight(carp, 'nonsense')).toBe(spawnWeight(carp));
  });

  it('a bait never produces a species the zone and time do not allow', () => {
    for (const bait of [undefined, ...BAITS.map((b) => b.id)]) {
      for (const zone of ['shallow', 'deep'] as const) {
        for (const time of ['dawn', 'day', 'dusk', 'night'] as const) {
          const allowed = new Set(candidates(zone, time).map((s) => s.id));
          const rng = seededRng(3);
          for (let i = 0; i < 300; i++) expect(allowed.has(pickSpecies(zone, time, rng, bait).id), `${bait} ${zone} ${time}`).toBe(true);
        }
      }
    }
  });

  it('corn at night in deep water cannot bring a daytime-only carp-like species that is not allowed', () => {
    // Tench is dawn/dusk only: corn must not put it in a night pool.
    const rng = seededRng(5);
    for (let i = 0; i < 400; i++) expect(pickSpecies('deep', 'night', rng, 'corn').id).not.toBe('tench');
  });

  it('the legendary is unaffected: it still replaces the pick on its own rule, whatever the bait', () => {
    // Inside the window and deep enough, a forced low roll gives the Pale One with or without bait.
    const place = { distanceM: 35, minute: 3 * 60 };
    for (const bait of [undefined, 'glow', 'corn']) {
      const hooked = rollHookedFish('deep', 'night', () => 0, undefined, place, bait);
      expect(hooked.speciesId).toBe('pale');
    }
    // Outside the window no bait can summon it.
    const rng = seededRng(2);
    for (let i = 0; i < 500; i++) expect(rollHookedFish('deep', 'day', rng, undefined, { distanceM: 35, minute: 12 * 60 }, 'glow').speciesId).not.toBe('pale');
  });
});

describe('bite wait (maggots)', () => {
  const ctx = (baitId: string | undefined, rod = RODS[0], seed = 11): SessionContext => ({
    location: QUIET_LAKE,
    rod,
    barGear: STARTER_BAR_GEAR,
    rng: seededRng(seed),
    timeOfDay: () => 'day',
    baitId: () => baitId,
  });
  const waitAfterCast = (c: SessionContext): number => {
    const inputs: FishingInput[] = [{ type: 'press' }, { type: 'tick', dtMs: CHARGE_HALF_CYCLE_MS }, { type: 'release' }, { type: 'landed' }];
    let state = INITIAL_STATE;
    for (const i of inputs) state = step(state, i, c).state;
    if (state.kind !== 'waiting') throw new Error('expected waiting');
    return state.untilMs;
  };

  it('the factor is 0.6 in shallow water only', () => {
    expect(firstWaitFactor('maggots', 'shallow')).toBe(0.6);
    expect(firstWaitFactor('maggots', 'deep')).toBe(1);
    expect(firstWaitFactor('corn', 'shallow')).toBe(1);
    expect(firstWaitFactor(undefined, 'shallow')).toBe(1);
    expect(firstWaitFactor(WORM_ID, 'shallow')).toBe(1);
  });

  it('a shallow cast with maggots waits 0.6 times as long as the same cast with worms', () => {
    const worms = waitAfterCast(ctx(WORM_ID));
    const maggots = waitAfterCast(ctx('maggots'));
    expect(maggots).toBeCloseTo(worms * 0.6, 5);
  });

  it('a deep cast is not shortened', () => {
    const carbon = RODS[RODS.length - 1];
    expect(waitAfterCast(ctx('maggots', carbon))).toBeCloseTo(waitAfterCast(ctx(WORM_ID, carbon)), 5);
  });
});

describe('inventory: choosing and using baits', () => {
  const withBaits = (baits: Record<string, number>, baitId?: string, extra: Partial<PlayerState> = {}): PlayerState => ({ ...newPlayer(), baits, baitId, ...extra });
  const caught: GameEvent = { type: 'fishCaught', zone: 'shallow', pattern: 'smooth', difficulty: 0.1, fightMs: 5000, speciesId: 'roach', lengthCm: 20, weightG: 100 };
  const lost: GameEvent = { type: 'fishLost', zone: 'shallow', pattern: 'smooth', difficulty: 0.1, speciesId: 'roach' };

  it('counts and chooses: worms by default, a bait only while she has some', () => {
    const p = withBaits({ corn: 4 });
    expect(chosenBait(p)).toBe(WORM_ID);
    expect(baitCount(p, 'corn')).toBe(4);
    expect(baitCount(p, WORM_ID)).toBe(p.worms);
    const c = chooseBait(p, 'corn');
    expect(c.ok).toBe(true);
    expect(chosenBait(c.state)).toBe('corn');
    expect(chooseBait(p, 'maggots').ok).toBe(false); // none owned
    expect(chooseBait(p, 'nope').ok).toBe(false);
    expect(chooseBait(c.state, WORM_ID).ok).toBe(true);
  });

  it('ownedBaits lists worms first, then each bait she has', () => {
    expect(ownedBaits(newPlayer()).map((b) => b.id)).toEqual([WORM_ID]);
    expect(ownedBaits(withBaits({ strip: 2, corn: 5 })).map((b) => b.id)).toEqual([WORM_ID, 'corn', 'strip']);
  });

  it('a caught fish uses the chosen bait, not a worm', () => {
    const r = applyEvent(withBaits({ corn: 3 }, 'corn'), caught, seededRng(1));
    expect(r.state.baits?.corn).toBe(2);
    expect(r.state.worms).toBe(newPlayer().worms);
    expect(r.wormUsed).toBe(false);
    expect(r.baitUsed).toBe('corn');
  });

  it('a lost fight uses it about half the time', () => {
    const p = withBaits({ corn: 3 }, 'corn');
    expect(applyEvent(p, lost, () => 0.2).baitUsed).toBe('corn');
    expect(applyEvent(p, lost, () => 0.7).baitUsed).toBeUndefined();
    expect(applyEvent(p, { type: 'nibble' }, () => 0).state).toBe(p);
  });

  it('the last one falls back to worms, and she can still cast', () => {
    const r = applyEvent(withBaits({ corn: 1 }, 'corn'), caught, seededRng(1));
    expect(r.state.baits?.corn).toBe(0);
    expect(r.state.baitId).toBeUndefined();
    expect(chosenBait(r.state)).toBe(WORM_ID);
    expect(canCast(r.state)).toBe(true);
    // Even if baitId is still set to an empty bait, it reads as worms.
    expect(chosenBait(withBaits({ corn: 0 }, 'corn'))).toBe(WORM_ID);
  });

  it('worms chosen but none left: the bait with the most pieces is used (ties: data order)', () => {
    const p = withBaits({ corn: 2, strip: 5, maggots: 5 }, undefined, { worms: 0 });
    expect(chosenBait(p)).toBe('maggots');
    const r = applyEvent(withBaits({ corn: 2 }, undefined, { worms: 0 }), caught, seededRng(1));
    expect(r.baitUsed).toBe('corn');
    expect(r.state.baits?.corn).toBe(1);
    expect(chosenBait(withBaits({}, undefined, { worms: 0 }))).toBe(WORM_ID);
  });

  it('a chosen bait that ran out falls back to worms first, then to the biggest stock', () => {
    expect(chosenBait(withBaits({ corn: 0, strip: 9 }, 'corn', { worms: 3 }))).toBe(WORM_ID);
    expect(chosenBait(withBaits({ corn: 0, strip: 9 }, 'corn', { worms: 0 }))).toBe('strip');
  });

  it('worms are used as before when worms are chosen', () => {
    const r = applyEvent(withBaits({ corn: 3 }), caught, seededRng(1));
    expect(r.wormUsed).toBe(true);
    expect(r.state.worms).toBe(newPlayer().worms - 1);
    expect(r.state.baits?.corn).toBe(3);
  });

  it('canCast: chosen bait or worms; nothing at all is no', () => {
    expect(canCast(withBaits({ corn: 2 }, 'corn', { worms: 0 }))).toBe(true);
    expect(canCast(withBaits({ corn: 2 }, undefined, { worms: 0 }))).toBe(true); // worms chosen, none left: corn is used
    expect(canCast(withBaits({}, undefined, { worms: 0 }))).toBe(false);
    expect(canCast(withBaits({ corn: 0 }, 'corn', { worms: 3 }))).toBe(true); // falls back to worms
  });

  it('the soft-lock guard counts every bait', () => {
    const stuck = { ...newPlayer(), worms: 0, coins: 0 };
    expect(freeWormsIfStuck(stuck).granted).toBe(true);
    expect(freeWormsIfStuck({ ...stuck, baits: { glow: 1 } }).granted).toBe(false);
  });

  it('buyBait: pays the pack price and adds the pack; refuses glow, unknown ids and a thin purse', () => {
    const corn = baitById('corn')!.pack!;
    const p = { ...newPlayer(), coins: 100 };
    const r = buyBait(p, 'corn');
    expect(r.ok).toBe(true);
    expect(r.state.coins).toBe(100 - corn.price);
    expect(baitCount(r.state, 'corn')).toBe(corn.size);
    expect(buyBait(p, 'glow')).toMatchObject({ ok: false, error: 'notSold' });
    expect(buyBait(p, 'nope')).toMatchObject({ ok: false, error: 'notSold' });
    expect(buyBait({ ...p, coins: corn.price - 1 }, 'corn')).toMatchObject({ ok: false, error: 'needCoins', missing: 1 });
    expect(p.baits).toBeUndefined(); // no mutation
  });

  it('addBait ignores unknown ids and non-positive counts', () => {
    const p = newPlayer();
    expect(addBait(p, 'nope', 3)).toBe(p);
    expect(addBait(p, 'corn', 0)).toBe(p);
    expect(addBait(p, WORM_ID, 2).worms).toBe(p.worms + 2);
  });
});

describe('save normalisation', () => {
  it('keeps known baits and the choice, drops unknown ids, negatives and NaN', () => {
    const r = normalizeSave({ version: 1, player: { baits: { corn: 4.9, maggots: -3, strip: NaN, glow: 'x', ghost: 7 }, baitId: 'corn' }, clock: {} });
    expect(r.player.baits).toEqual({ corn: 4 });
    expect(r.player.baitId).toBe('corn');
    const bad = normalizeSave({ version: 1, player: { baits: 'lots', baitId: 'ghost' }, clock: {} });
    expect(bad.player.baits).toBeUndefined();
    expect(bad.player.baitId).toBeUndefined();
  });
  it('an old save gets no bait keys', () => {
    const r = normalizeSave({ version: 1, player: { coins: 5 }, clock: {} });
    expect('baits' in r.player).toBe(false);
    expect('baitId' in r.player).toBe(false);
  });
  it('a quest reward keeps a known bait part and drops a broken one', () => {
    const quest = (bait: unknown) => ({ kind: 'catchAny', params: { target: 8 }, progress: 0, done: false, claimed: false, reward: { coins: 20, worms: 3, bait } });
    const q = (b: unknown) => normalizeSave({ version: 1, player: { quests: { date: '2026-11-23', rerollUsed: false, list: [quest(b)] } }, clock: {} }).player.quests!.list[0].reward;
    expect(q({ id: 'corn', n: 4 })).toEqual({ coins: 20, worms: 3, bait: { id: 'corn', n: 4 } });
    expect(q({ id: 'ghost', n: 4 })).toEqual({ coins: 20, worms: 3 });
    expect(q({ id: 'corn', n: -2 })).toEqual({ coins: 20, worms: 3 });
  });
});

describe('daily box baits', () => {
  it('no glow bait at tier 1; 25% at tier 2 rising to the top tier', () => {
    expect(glowChance(1)).toBe(0);
    expect(glowChance(2)).toBeCloseTo(0.25);
    expect(glowChance(5)).toBeCloseTo(0.6);
    expect(glowChance(3)).toBeGreaterThan(glowChance(2));
  });

  it('the rates match over many boxes (tier 2: about 25% glow, 1-3 each)', () => {
    const rng = seededRng(21);
    let glow = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const g = rollContents(2, rng).baits.glow;
      if (g) {
        glow++;
        expect(g).toBeGreaterThanOrEqual(1);
        expect(g).toBeLessThanOrEqual(3);
      }
    }
    expect(glow / n).toBeGreaterThan(0.21);
    expect(glow / n).toBeLessThan(0.29);
    const t1 = seededRng(22);
    for (let i = 0; i < 500; i++) expect(rollContents(1, t1).baits.glow).toBeUndefined();
  });

  it('a pack, when one comes, is a shop bait of 3-5', () => {
    const rng = seededRng(23);
    for (let i = 0; i < 1000; i++) {
      for (const [id, n] of Object.entries(rollContents(1, rng).baits)) {
        expect(SHOP_BAITS.map((b) => b.id)).toContain(id);
        expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeLessThanOrEqual(5);
      }
    }
  });

  it('opening a box adds the baits to the player', () => {
    const r = openBox({ ...newPlayer(), daily: { lastBoxDate: '2026-11-22', streakTier: 1 } }, '2026-11-23', () => 0);
    expect(r.contents!.tier).toBe(2);
    expect(r.contents!.baits.glow).toBeGreaterThanOrEqual(1);
    expect(baitCount(r.player, 'glow')).toBe(r.contents!.baits.glow);
  });
});

describe('quest bait rewards', () => {
  const days = (n: number): Quest[] => Array.from({ length: n }, (_, i) => rollDay(`2027-01-${String((i % 28) + 1).padStart(2, '0')}`, newPlayer())).flat();

  it('about 1 quest in 4 pays bait: 3-5 of a shop bait, or rarely 1 glow', () => {
    const quests = Array.from({ length: 400 }, (_, i) => rollDay(`${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-10`, newPlayer())).flat();
    const withBait = quests.filter((q) => q.reward.bait);
    const rate = withBait.length / quests.length;
    expect(rate).toBeGreaterThan(0.18);
    expect(rate).toBeLessThan(0.32);
    for (const q of withBait) {
      const b = q.reward.bait!;
      expect(baitById(b.id)).toBeDefined();
      if (b.id === 'glow') expect(b.n).toBe(1);
      else {
        expect(b.n).toBeGreaterThanOrEqual(QUEST_TUNING.baitReward.shopN[0]);
        expect(b.n).toBeLessThanOrEqual(QUEST_TUNING.baitReward.shopN[1]);
      }
    }
    expect(withBait.filter((q) => q.reward.bait!.id === 'glow').length).toBeLessThan(withBait.length / 3);
    expect(days(3)).toHaveLength(9);
  });

  it('claiming pays the bait; the text names it', () => {
    const quest: Quest = { kind: 'catchAny', params: { target: 8 }, progress: 8, done: true, claimed: false, reward: { coins: 20, worms: 3, bait: { id: 'corn', n: 4 } } };
    const p: PlayerState = { ...newPlayer(), quests: { date: '2026-11-23', rerollUsed: false, list: [quest] } };
    const r = claimQuest(p, 0);
    expect(baitCount(r.player, 'corn')).toBe(4);
    expect(rewardText(quest.reward)).toBe('+20 coins · +3 worms · +4 corn');
    expect(rewardText({ coins: 20, worms: 3 })).toBe('+20 coins · +3 worms');
  });

  it('a day change pays the unclaimed bait too', () => {
    const quest: Quest = { kind: 'catchAny', params: { target: 8 }, progress: 8, done: true, claimed: false, reward: { coins: 20, worms: 3, bait: { id: 'strip', n: 5 } } };
    const p: PlayerState = { ...newPlayer(), quests: { date: '2026-11-23', rerollUsed: false, list: [quest] } };
    const r = syncQuests(p, '2026-11-24');
    expect(r.paid?.baits).toEqual({ strip: 5 });
    expect(baitCount(r.player, 'strip')).toBe(5);
  });
});

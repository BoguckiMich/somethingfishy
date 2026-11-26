import { describe, expect, it } from 'vitest';
import { CATCH_BAR_TUNING, barResult, coreHalf, isPerfect, newCatchBar, tickCatchBar, type CatchBarState, type FishProfile } from './catchBar';
import { allButPetrol, fits, giveWarning, slotFilled } from './checklist/checklist';
import { STARTER_BAR_GEAR } from './data/barGear';
import { RODS } from './data/rods';
import { SPECIES, speciesById } from './data/fish';
import { TIER_RANK, bagTier, isGoldOrBetter, lengthForStar, starFor, tierFor, type Star, type Tier } from './data/stars';
import { fightProfile, rollLength } from './fish';
import { bestStar, goldCount, recordCatch } from './fishLog';
import { newPlayer, toBagFish, addCatch, priceFor, type BagFish } from './inventory';
import { addTrophy, normalizeTrophies } from './rare';
import { seededRng } from './random';
import { normalizeSave } from './save';
import { step } from './fishingSession';

const perch = speciesById('perch')!;
const TICK = 16;
const hooked = (id: string, star: Star) => {
  const sp = speciesById(id)!;
  const lengthCm = lengthForStar(sp, star);
  return { speciesId: id, lengthCm, weightG: 100 };
};

describe('the sweet spot (red core)', () => {
  it('every rod has a core: bamboo 20 %, fiberglass 30 %, carbon 40 % of the zone', () => {
    expect(RODS.map((r) => r.barGear.coreShare)).toEqual([0.2, 0.3, 0.4]);
    expect(coreHalf({ ...STARTER_BAR_GEAR, zoneSize: 0.3, coreShare: 0.2 })).toBeCloseTo(0.03);
    expect(coreHalf({ ...STARTER_BAR_GEAR, coreShare: undefined })).toBe(0);
  });

  const still = (offset: number, gear = STARTER_BAR_GEAR): { s: CatchBarState; fish: FishProfile } => {
    const fish: FishProfile = { pattern: 'smooth', difficulty: 0.1 };
    const s0 = newCatchBar(fish, gear, seededRng(2));
    // The fish parked `offset` from the zone centre and never moving; the zone stays put (nobody holds, it rests on the bottom).
    return { fish, s: { ...s0, fish: s0.zone + offset, fishTarget: s0.zone + offset, fishTimer: 99, fishVel: 0, progress: 0.3 } };
  };
  const gain = (offset: number, gear = STARTER_BAR_GEAR) => {
    const { s, fish } = still(offset, gear);
    const next = tickCatchBar(s, 500, false, fish, gear, seededRng(1));
    return next.progress - 0.3;
  };

  it('progress fills x1.5 while the fish is in the core, x1 in the rest of the green', () => {
    const half = STARTER_BAR_GEAR.zoneSize / 2;
    const inGreen = gain(half * 0.8);
    const inCore = gain(coreHalf(STARTER_BAR_GEAR) * 0.5);
    expect(inGreen).toBeGreaterThan(0);
    expect(inCore / inGreen).toBeCloseTo(CATCH_BAR_TUNING.coreFillMult, 1);
    expect(CATCH_BAR_TUNING.coreFillMult).toBe(1.5);
  });

  it('no core means no bonus (a gear without coreShare plays as before)', () => {
    const plain = { ...STARTER_BAR_GEAR, coreShare: 0 };
    expect(gain(0, plain)).toBeCloseTo(gain((STARTER_BAR_GEAR.zoneSize / 2) * 0.8, plain), 5);
  });

  it('the core edge is exact: just inside it fills x1.5, just outside x1', () => {
    const edge = coreHalf(STARTER_BAR_GEAR);
    expect(gain(edge - 0.001)).toBeGreaterThan(gain(edge + 0.01) * 1.4);
  });
});

describe('perfect catch tracking in the fight state', () => {
  const gear = STARTER_BAR_GEAR;
  const fish: FishProfile = { pattern: 'smooth', difficulty: 0.1 };

  it('stays perfect while the fish is inside, with the same test that lets progress fill', () => {
    const s0 = newCatchBar(fish, gear, seededRng(2));
    expect(s0.leftZone).toBe(false);
    const inside: CatchBarState = { ...s0, fish: s0.zone + gear.zoneSize / 2 + CATCH_BAR_TUNING.fishTolerance - 0.001, fishTarget: s0.zone, fishTimer: 99, fishVel: 0 };
    expect(tickCatchBar(inside, TICK, false, fish, gear, seededRng(1)).leftZone).toBe(false);
  });

  it('a short time outside is forgiven: up to 300 ms in total, over the whole fight', () => {
    const s0 = newCatchBar(fish, gear, seededRng(2));
    const outside: CatchBarState = { ...s0, fish: s0.zone + gear.zoneSize / 2 + CATCH_BAR_TUNING.fishTolerance + 0.01, fishTarget: s0.fish, fishTimer: 99, fishVel: 0 };
    expect(CATCH_BAR_TUNING.perfectGraceMs).toBe(300);
    let s = tickCatchBar(outside, TICK, false, fish, gear, seededRng(1));
    expect(s.leftZone).toBe(false);
    expect(s.outsideTotalMs).toBeGreaterThan(0);
    // 250 ms outside, a stretch inside, then 100 ms more outside: the TOTAL (not the longest run) decides.
    s = { ...outside, outsideTotalMs: 250 };
    s = tickCatchBar(s, 48, false, fish, gear, seededRng(1));
    expect(s.leftZone).toBe(false);
    s = { ...s, fish: s.zone, fishTarget: s.zone, outsideTotalMs: 250 };
    s = tickCatchBar(s, 48, false, fish, gear, seededRng(1));
    expect(s.outsideTotalMs).toBe(250);
    s = { ...s, fish: s.zone + gear.zoneSize / 2 + CATCH_BAR_TUNING.fishTolerance + 0.01, fishTarget: s.fish, fishTimer: 99, fishVel: 0, accMs: 0 };
    s = tickCatchBar(s, 96, false, fish, gear, seededRng(1));
    expect(s.leftZone).toBe(true);
  });

  it('more than the grace outside ends the perfect run for good, even if the fish comes straight back', () => {
    const s0 = newCatchBar(fish, gear, seededRng(2));
    const outside: CatchBarState = { ...s0, fish: s0.zone + gear.zoneSize / 2 + CATCH_BAR_TUNING.fishTolerance + 0.01, fishTarget: s0.zone, fishTimer: 99, fishVel: 0, outsideTotalMs: CATCH_BAR_TUNING.perfectGraceMs };
    let s = tickCatchBar(outside, TICK, false, fish, gear, seededRng(1));
    expect(s.leftZone).toBe(true);
    s = { ...s, fish: s.zone, fishTarget: s.zone, fishVel: 0, progress: 0.999 };
    for (let i = 0; i < 30 && barResult(s) === 'fighting'; i++) s = tickCatchBar(s, TICK, false, fish, gear, seededRng(1));
    expect(barResult(s)).toBe('caught');
    expect(isPerfect(s)).toBe(false);
  });

  it('a fish that stays inside until the bar is full is a perfect catch, and the session event says so', () => {
    const s0 = newCatchBar(fish, gear, seededRng(2));
    const steady = { ...s0, fish: s0.zone, fishTarget: s0.zone, fishTimer: 999, fishVel: 0 };
    let s: CatchBarState = { ...steady, progress: 0.99 };
    for (let i = 0; i < 100 && barResult(s) === 'fighting'; i++) s = tickCatchBar(s, TICK, false, fish, gear, seededRng(1));
    expect(isPerfect(s)).toBe(true);
    const fighting = {
      kind: 'fighting' as const, distanceM: 10, zone: 'shallow' as const, hooked: { speciesId: 'perch', lengthCm: 20, weightG: 100 }, fish,
      bar: { ...steady, progress: 0.9999 },
    };
    const ctx = { rng: seededRng(5), barGear: gear } as never;
    const done = step(fighting, { type: 'tick', dtMs: 200 }, ctx);
    expect(done.events.find((e) => e.type === 'fishCaught')).toMatchObject({ perfect: true });
    const dirty = step({ ...fighting, bar: { ...fighting.bar, leftZone: true } }, { type: 'tick', dtMs: 200 }, ctx);
    expect(dirty.events.find((e) => e.type === 'fishCaught')).not.toHaveProperty('perfect');
  });
});

describe('tierFor: +1 tier for a perfect catch, a medal only for a gold-size one', () => {
  it('none -> bronze -> silver -> gold -> medal', () => {
    const want: [Star, Tier][] = [['none', 'bronze'], ['bronze', 'silver'], ['silver', 'gold'], ['gold', 'medal']];
    for (const [star, perfect] of want) expect(tierFor(perch, lengthForStar(perch, star), true)).toBe(perfect);
  });
  it('without a perfect catch it is the plain star', () => {
    for (const star of ['none', 'bronze', 'silver', 'gold'] as const) expect(tierFor(perch, lengthForStar(perch, star), false)).toBe(star);
  });
  it('every normal species follows the ladder', () => {
    for (const sp of SPECIES.filter((s) => s.rarity !== 'legendary' && s.rarity !== 'trophy')) {
      for (const star of ['none', 'bronze', 'silver', 'gold'] as const) {
        const t = tierFor(sp, lengthForStar(sp, star), true);
        expect(TIER_RANK[t]).toBe(TIER_RANK[star] + 1);
        if (t === 'medal') expect(star).toBe('gold');
      }
    }
  });
  it('the legendary has no tier, a trophy only a medal (perfect and gold size)', () => {
    const pale = speciesById('pale')!;
    expect(tierFor(pale, pale.lengthCm[1], true)).toBe('none');
    const t = speciesById('mossback')!;
    expect(tierFor(t, t.lengthCm[1], true)).toBe('medal');
    expect(tierFor(t, t.lengthCm[1], false)).toBe('none');
    expect(tierFor(t, t.lengthCm[0], true)).toBe('none');
    expect(starFor(t, t.lengthCm[1])).toBe('none');
  });
  it('a medal counts as gold', () => {
    expect(isGoldOrBetter('medal')).toBe(true);
    expect(isGoldOrBetter('silver')).toBe(false);
  });
});

describe('the bag keeps the tier, the price stays by size', () => {
  it('a perfect bronze-size fish is a silver fish in the bag but sells for the same coins', () => {
    const h = hooked('perch', 'bronze');
    const plain = toBagFish(h);
    const perfect = toBagFish(h, undefined, true);
    expect(perfect.price).toBe(plain.price);
    expect(perfect.price).toBe(priceFor(perch, h.lengthCm));
    expect(plain).not.toHaveProperty('perfect');
    expect(perfect.perfect).toBe(true);
    expect(bagTier(plain)).toBe('bronze');
    expect(bagTier(perfect)).toBe('silver');
    expect(addCatch(newPlayer(), h, undefined, true).fish.perfect).toBe(true);
  });
  it('survives a save and load', () => {
    const fish = toBagFish(hooked('perch', 'bronze'), undefined, true);
    const loaded = normalizeSave({ version: 1, player: { ...newPlayer(), bag: [fish, toBagFish(hooked('perch', 'gold'))] } });
    expect(loaded.player.bag[0].perfect).toBe(true);
    expect(loaded.player.bag[1]).not.toHaveProperty('perfect');
    expect(normalizeSave({ version: 1, player: { ...newPlayer(), bag: [{ ...fish, perfect: 'yes' }] } }).player.bag[0]).not.toHaveProperty('perfect');
  });
});

describe('checklist star slots', () => {
  const bag = (f: BagFish) => ({ ...newPlayer(), bag: [f] });
  it('a perfect bronze-size fish fills a silver slot, a perfect silver-size fish a gold slot, a plain one does not', () => {
    const bronze = toBagFish(hooked('perch', 'bronze'));
    const silver = toBagFish(hooked('perch', 'silver'));
    expect(fits({ kind: 'star', min: 'silver' }, bronze)).toBe(false);
    expect(fits({ kind: 'star', min: 'silver' }, { ...bronze, perfect: true })).toBe(true);
    expect(fits({ kind: 'star', min: 'gold' }, silver)).toBe(false);
    expect(fits({ kind: 'star', min: 'gold' }, { ...silver, perfect: true })).toBe(true);
  });
  it('a medal fish counts as gold, and Give warns about it', () => {
    const medal = { ...toBagFish(hooked('perch', 'gold')), perfect: true as const };
    expect(bagTier(medal)).toBe('medal');
    expect(fits({ kind: 'star', min: 'gold' }, medal)).toBe(true);
    const w = giveWarning(bag(medal), 'shiny-ones', 0);
    expect(w?.gold).toBe(true);
    expect(w?.text).toContain('medal');
    expect(slotFilled(allButPetrol(newPlayer()), 'shiny-ones', 0)).toBe(true);
  });
});

describe('the log keeps the best tier of a perfect catch', () => {
  it('a perfect small catch lifts the species tier without touching the record', () => {
    const small = hooked('perch', 'bronze');
    let r = recordCatch({}, small, false);
    expect(bestStar(r.log, perch)).toBe('bronze');
    const big = hooked('perch', 'silver');
    r = recordCatch(r.log, big, false);
    expect(bestStar(r.log, perch)).toBe('silver');
    r = recordCatch(r.log, hooked('perch', 'silver'), true); // not a record (same length), but perfect: silver-size -> gold
    expect(r.outcome.kind).toBe('normal');
    expect(r.log.perch.bestLengthCm).toBe(big.lengthCm);
    expect(bestStar(r.log, perch)).toBe('gold');
    expect(r.log.perch.bestTier).toBe('gold');
    expect(r.log.perch.count).toBe(3);
  });
  it('is stored only when it beats the record length, never goes down, and a gold-size perfect fish is a medal', () => {
    let r = recordCatch({}, hooked('perch', 'gold'), false);
    expect(r.log.perch).not.toHaveProperty('bestTier');
    r = recordCatch(r.log, hooked('perch', 'bronze'), true);
    expect(r.log.perch).not.toHaveProperty('bestTier'); // bronze-size perfect = silver, below the record's gold
    r = recordCatch(r.log, hooked('perch', 'gold'), true);
    expect(bestStar(r.log, perch)).toBe('medal');
    r = recordCatch(r.log, hooked('perch', 'none'), false);
    expect(bestStar(r.log, perch)).toBe('medal');
    expect(goldCount(r.log)).toBe(1);
  });
  it('old saves (no bestTier) read as before, and loading keeps or drops the field sensibly', () => {
    const old = { perch: { count: 2, bestLengthCm: lengthForStar(perch, 'silver'), bestWeightG: 100 } };
    expect(bestStar(old, perch)).toBe('silver');
    const keep = normalizeSave({ version: 1, player: { ...newPlayer(), log: { perch: { ...old.perch, bestTier: 'medal' } } } });
    expect(keep.player.log.perch.bestTier).toBe('medal');
    const lower = normalizeSave({ version: 1, player: { ...newPlayer(), log: { perch: { ...old.perch, bestTier: 'bronze' } } } });
    expect(lower.player.log.perch).not.toHaveProperty('bestTier');
    const junk = normalizeSave({ version: 1, player: { ...newPlayer(), log: { perch: { ...old.perch, bestTier: 'platinum' } } } });
    expect(junk.player.log.perch).not.toHaveProperty('bestTier');
    expect(bestStar(junk.player.log, perch)).toBe('silver');
  });
});

describe('the trophy board medal', () => {
  const big = (id: string) => ({ speciesId: id, lengthCm: speciesById(id)!.lengthCm[1], weightG: 1000 });
  it('a perfect gold-size catch earns the medal; a small or imperfect one does not; it sticks', () => {
    const a = addTrophy(undefined, big('mossback'), '2026-11-24', true);
    expect(a.trophies.mossback.medal).toBe(true);
    const plain = addTrophy(undefined, big('mossback'), '2026-11-24');
    expect(plain.trophies.mossback).not.toHaveProperty('medal');
    const small = addTrophy(undefined, { speciesId: 'mossback', lengthCm: speciesById('mossback')!.lengthCm[0], weightG: 100 }, '', true);
    expect(small.trophies.mossback).not.toHaveProperty('medal');
    // the medal comes later on a catch that is not bigger
    const later = addTrophy(plain.trophies, big('mossback'), '2026-11-25', true);
    expect(later.trophies.mossback.medal).toBe(true);
    expect(later).toMatchObject({ first: false, improved: false, changed: true });
    expect(addTrophy(later.trophies, big('mossback'), '2026-11-26', true).changed).toBe(false);
    // and a later bigger plain catch keeps it
    const bigger = addTrophy(a.trophies, { ...big('mossback'), lengthCm: big('mossback').lengthCm + 5 }, '2026-11-26');
    expect(bigger.trophies.mossback.medal).toBe(true);
  });
  it('saves the medal and drops junk', () => {
    const t = { mossback: { lengthCm: 100, weightG: 1, date: '', medal: true } };
    expect(normalizeTrophies(t)).toEqual(t);
    expect(normalizeTrophies({ mossback: { ...t.mossback, medal: 'x' } }).mossback).not.toHaveProperty('medal');
  });
});

describe('the sim: the core keeps the audit rules', () => {
  const MAX = 90_000;
  const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
  type Bot = { delayMs: number; noise: number } | 'never';
  function play(fish: FishProfile, gear: typeof STARTER_BAR_GEAR, seed: number, bot: Bot): { won: boolean; perfect: boolean } {
    const rng = seededRng(seed);
    const noise = seededRng(seed + 7919);
    let s = newCatchBar(fish, gear, rng);
    const q: boolean[] = [];
    const d = bot === 'never' ? 0 : Math.round(bot.delayMs / TICK);
    for (let ms = 0; ms < MAX; ms += TICK) {
      let h = false;
      if (bot !== 'never') {
        q.push(s.fish - s.zone + (bot.noise ? (noise() * 2 - 1) * bot.noise : 0) > 0);
        h = q.length > d ? q.shift()! : false;
      }
      s = tickCatchBar(s, TICK, h, fish, gear, rng);
      const r = barResult(s);
      if (r !== 'fighting') return { won: r === 'caught', perfect: isPerfect(s) };
    }
    return { won: false, perfect: false };
  }
  const run = (id: string, rod: number, bot: Bot, n = 100) => {
    const sp = speciesById(id)!;
    return seeds(n).map((seed) => play(fightProfile(sp, rollLength(sp, seededRng(seed * 977))), RODS[rod].barGear, seed, bot));
  };
  const wins = (rs: { won: boolean }[]) => rs.filter((r) => r.won).length / rs.length;

  it('a player who never presses still loses the fish that need pressing (catfish, pike, asp, the trophies)', () => {
    for (const [id, rod] of [['catfish', 1], ['catfish', 2], ['pike', 1], ['pike', 2], ['asp', 0], ['goldenTench', 1], ['mossback', 2], ['silverGhost', 0]] as const) {
      expect(wins(run(id, rod, 'never')), `${id} rod ${rod}`).toBeLessThanOrEqual(0.15);
    }
  });
  it('a perfect catch is rare but possible for a good player, and rarer for a sloppy one', () => {
    const good = run('roach', 0, { delayMs: 150, noise: 0 }, 150);
    const sloppy = run('roach', 0, { delayMs: 300, noise: 0.1 }, 150);
    const goodPerfect = good.filter((r) => r.perfect).length / good.length;
    const sloppyPerfect = sloppy.filter((r) => r.perfect).length / sloppy.length;
    expect(goodPerfect).toBeGreaterThan(0.1);
    expect(goodPerfect).toBeLessThan(0.7);
    expect(sloppyPerfect).toBeLessThan(goodPerfect);
    expect(run('pike', 1, { delayMs: 150, noise: 0 }, 150).filter((r) => r.perfect).length).toBeLessThanOrEqual(10);
    expect(run('catfish', 1, 'never', 150).filter((r) => r.perfect).length).toBeLessThanOrEqual(3);
  });
  it('the core makes a bigger rod no harder: the carbon rod is never worse than fiberglass for the good bot', () => {
    for (const id of ['catfish', 'carp', 'pike', 'tench']) {
      expect(wins(run(id, 2, { delayMs: 150, noise: 0 })), id).toBeGreaterThanOrEqual(wins(run(id, 1, { delayMs: 150, noise: 0 })) - 0.05);
    }
  });
});

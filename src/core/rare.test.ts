import { describe, expect, it } from 'vitest';
import { LAKE_ID, RARE_RULES, RARE_TUNING, RIVER_ID, TROPHY_IDS, trophyIdsAt } from './data/rare';
import { speciesById } from './data/fish';
import { rollHookedFish } from './fish';
import { addTrophy, boardIds, fullBoard, normalizeTrophies, rareCanSpawn, rollRare, ruleMet, unknownHints, type RareCast } from './rare';
import { whereWhen } from './fishLog';
import { seededRng } from './random';
import { weatherEffects } from './daily/weather';
import { timeOfDay } from './clock';

const hm = (h: number, m = 0) => h * 60 + m;
const rule = (id: string) => RARE_RULES.find((r) => r.speciesId === id)!;

/** A cast that meets every condition of the trophy. */
const GOOD: Record<string, RareCast> = {
  goldenTench: { zone: 'deep', distanceM: 20, minute: hm(6), weather: 'rain', baitId: 'worm' },
  mossback: { zone: 'deep', distanceM: 32, minute: hm(14), weather: 'fog', baitId: 'corn' },
  silverGhost: { zone: 'shallow', distanceM: 8, minute: hm(12), weather: 'sunny', baitId: 'maggots' },
  // The river's (slice 25f); the full rules are tested in riverTrophies.test.ts
  lantern: { placeId: RIVER_ID, bandId: 'riffle', zone: 'shallow', distanceM: 6, minute: hm(23), weather: 'rain', baitId: 'maggots' },
  barbelKing: { placeId: RIVER_ID, bandId: 'pool', zone: 'deep', distanceM: 33, minute: hm(18, 30), weather: 'overcast', baitId: 'strip' },
  ferryPike: { placeId: RIVER_ID, bandId: 'seam', zone: 'shallow', distanceM: 22, minute: hm(13), weather: 'windy', baitId: 'worm' },
};

describe('the three rare fish: every condition is needed', () => {
  it('each good cast meets its rule and only its own', () => {
    for (const id of TROPHY_IDS) {
      expect(rareCanSpawn(id, GOOD[id]), id).toBe(true);
      for (const other of TROPHY_IDS.filter((x) => x !== id)) expect(rareCanSpawn(other, GOOD[id]), `${other} on the cast of ${id}`).toBe(false);
    }
  });

  it('golden tench: rain, dawn or dusk, deep water', () => {
    const g = GOOD.goldenTench;
    expect(rareCanSpawn('goldenTench', { ...g, minute: hm(18, 30) })).toBe(true); // dusk
    expect(rareCanSpawn('goldenTench', { ...g, weather: 'overcast' })).toBe(false);
    expect(rareCanSpawn('goldenTench', { ...g, weather: undefined })).toBe(false);
    expect(rareCanSpawn('goldenTench', { ...g, minute: hm(12) })).toBe(false); // day
    expect(rareCanSpawn('goldenTench', { ...g, minute: hm(22) })).toBe(false); // night
    expect(rareCanSpawn('goldenTench', { ...g, zone: 'shallow' })).toBe(false);
    // the clock buckets come from core/clock: dawn 05:00-07:00, dusk 18:00-20:00
    expect(rareCanSpawn('goldenTench', { ...g, minute: hm(4, 59) })).toBe(false);
    expect(rareCanSpawn('goldenTench', { ...g, minute: hm(5) })).toBe(true);
    expect(rareCanSpawn('goldenTench', { ...g, minute: hm(7) })).toBe(false);
    expect(timeOfDay(hm(19, 59))).toBe('dusk');
    expect(rareCanSpawn('goldenTench', { ...g, minute: hm(19, 59) })).toBe(true);
  });

  it('Old Mossback: fog (any hour), corn bait, 30 m or more', () => {
    const g = GOOD.mossback;
    for (const h of [0, 6, 14, 23]) expect(rareCanSpawn('mossback', { ...g, minute: hm(h) }), `hour ${h}`).toBe(true);
    expect(rareCanSpawn('mossback', { ...g, weather: 'rain' })).toBe(false);
    expect(rareCanSpawn('mossback', { ...g, weather: undefined })).toBe(false);
    expect(rareCanSpawn('mossback', { ...g, baitId: 'maggots' })).toBe(false);
    expect(rareCanSpawn('mossback', { ...g, baitId: 'worm' })).toBe(false);
    expect(rareCanSpawn('mossback', { ...g, baitId: undefined })).toBe(false);
    expect(rareCanSpawn('mossback', { ...g, distanceM: 29.9 })).toBe(false);
    expect(rareCanSpawn('mossback', { ...g, distanceM: 30 })).toBe(true);
  });

  it('silver ghost: sunny, 11:00 to 13:00, shallow water, maggots', () => {
    const g = GOOD.silverGhost;
    expect(rareCanSpawn('silverGhost', { ...g, minute: hm(11) })).toBe(true);
    expect(rareCanSpawn('silverGhost', { ...g, minute: hm(12, 59) })).toBe(true);
    expect(rareCanSpawn('silverGhost', { ...g, minute: hm(10, 59) })).toBe(false);
    expect(rareCanSpawn('silverGhost', { ...g, minute: hm(13) })).toBe(false);
    expect(rareCanSpawn('silverGhost', { ...g, weather: 'windy' })).toBe(false);
    expect(rareCanSpawn('silverGhost', { ...g, weather: undefined })).toBe(false);
    expect(rareCanSpawn('silverGhost', { ...g, zone: 'deep' })).toBe(false);
    expect(rareCanSpawn('silverGhost', { ...g, baitId: 'corn' })).toBe(false);
    expect(rareCanSpawn('silverGhost', { ...g, baitId: undefined })).toBe(false);
  });

  it('the clock wraps (a minute past a day or below zero still reads as that time of day)', () => {
    expect(ruleMet(rule('silverGhost'), { ...GOOD.silverGhost, minute: 1440 + hm(12) })).toBe(true);
    expect(ruleMet(rule('silverGhost'), { ...GOOD.silverGhost, minute: -hm(11) })).toBe(false); // 13:00 the day before
    expect(ruleMet(rule('silverGhost'), { ...GOOD.silverGhost, minute: -hm(12) })).toBe(true);
  });
});

describe('rolling a rare fish', () => {
  const spy = () => {
    throw new Error('rng must not be drawn');
  };

  it('does not draw the rng, and never spawns, when no rule is met', () => {
    expect(rollRare({ zone: 'deep', distanceM: 40, minute: hm(3), weather: 'windy', baitId: 'corn' }, spy)).toBeUndefined();
    expect(rollRare({ zone: 'shallow', distanceM: 5, minute: hm(12), weather: 'sunny', baitId: 'worm' }, spy)).toBeUndefined();
    expect(rollRare({ zone: 'deep', distanceM: 40, minute: hm(14), weather: undefined, baitId: 'corn' }, spy)).toBeUndefined();
  });

  it('spawns about 20% of landed casts when everything holds, deterministic for a seed', () => {
    expect(RARE_TUNING.chance).toBe(0.2);
    for (const id of TROPHY_IDS) {
      const rng = seededRng(21);
      let hits = 0;
      const n = 4000;
      for (let i = 0; i < n; i++) if (rollRare(GOOD[id], rng)?.id === id) hits++;
      expect(hits / n, id).toBeGreaterThan(0.17);
      expect(hits / n, id).toBeLessThan(0.23);
      const a = Array.from({ length: 30 }, ((r) => () => rollRare(GOOD[id], r)?.id)(seededRng(8)));
      const b = Array.from({ length: 30 }, ((r) => () => rollRare(GOOD[id], r)?.id)(seededRng(8)));
      expect(a).toEqual(b);
    }
  });

  it('is part of the landed-cast roll: with the weather, bait and place it appears, without them never', () => {
    const count = (zone: 'deep' | 'shallow', time: 'dawn' | 'day', minute: number, distanceM: number, bait: string | undefined, weather: Parameters<typeof weatherEffects>[0]) => {
      const fx = weatherEffects(weather, minute);
      const rng = seededRng(5);
      let n = 0;
      for (let i = 0; i < 1500; i++) {
        const h = rollHookedFish(zone, time, rng, undefined, { distanceM, minute }, bait, undefined, fx);
        if (speciesById(h.speciesId)?.rarity === 'trophy') n++;
      }
      return n;
    };
    expect(count('shallow', 'day', hm(12), 8, 'maggots', 'sunny')).toBeGreaterThan(200);
    expect(count('shallow', 'day', hm(12), 8, 'worm', 'sunny')).toBe(0);
    expect(count('shallow', 'day', hm(12), 8, 'maggots', 'rain')).toBe(0);
    expect(count('deep', 'day', hm(14), 32, 'corn', 'fog')).toBeGreaterThan(200);
    expect(count('deep', 'day', hm(14), 25, 'corn', 'fog')).toBe(0);
    expect(count('deep', 'dawn', hm(6), 20, 'worm', 'rain')).toBeGreaterThan(200);
  });

  it('a trophy never comes from the weighted pool (no place given = no rare roll)', () => {
    const rng = seededRng(2);
    for (let i = 0; i < 2000; i++) {
      const h = rollHookedFish('deep', 'dawn', rng, undefined, undefined, 'corn', undefined, weatherEffects('rain', hm(6)));
      expect(speciesById(h.speciesId)?.rarity).not.toBe('trophy');
    }
  });
});

describe('the trophy board state', () => {
  const hooked = (id: string, lengthCm: number) => ({ speciesId: id, lengthCm, weightG: lengthCm * 40 });

  it('the first catch is first; a bigger one replaces it; a smaller or equal one changes nothing', () => {
    const a = addTrophy(undefined, hooked('mossback', 100), '2026-11-24');
    expect(a).toMatchObject({ first: true, improved: false, changed: true });
    expect(a.trophies.mossback).toEqual({ lengthCm: 100, weightG: 4000, date: '2026-11-24' });
    const b = addTrophy(a.trophies, hooked('mossback', 110), '2026-11-25');
    expect(b).toMatchObject({ first: false, improved: true, changed: true });
    expect(b.trophies.mossback.date).toBe('2026-11-25');
    const c = addTrophy(b.trophies, hooked('mossback', 110), '2026-11-26');
    expect(c).toMatchObject({ first: false, improved: false, changed: false });
    expect(c.trophies).toBe(b.trophies);
    expect(addTrophy(b.trophies, hooked('goldenTench', 50), 'bad date').trophies.goldenTench.date).toBe('');
  });

  it('the board lists the caught trophies in board order, then the Pale One when it is in the log', () => {
    const t = { silverGhost: { lengthCm: 30, weightG: 1, date: '' }, goldenTench: { lengthCm: 50, weightG: 1, date: '' } };
    expect(boardIds(t, {})).toEqual(['goldenTench', 'silverGhost']);
    expect(boardIds(t, { pale: {} })).toEqual(['goldenTench', 'silverGhost', 'pale']);
    expect(boardIds(undefined, {})).toEqual([]);
  });

  it('normalising keeps only clean entries; fullBoard has every trophy and survives it', () => {
    expect(normalizeTrophies(null)).toEqual({});
    expect(normalizeTrophies({ mossback: { lengthCm: 0, weightG: 1, date: '' } })).toEqual({});
    const full = fullBoard('2026-11-24');
    expect(Object.keys(full)).toEqual([...TROPHY_IDS]);
    expect(TROPHY_IDS).toHaveLength(6);
    expect(normalizeTrophies(full)).toEqual(full);
  });

  it('the rumours are the hints of the trophies not in the log yet', () => {
    expect(unknownHints({}).map((h) => h.id)).toEqual(['goldenTench', 'mossback', 'silverGhost']);
    expect(unknownHints({}, LAKE_ID).map((h) => h.id)).toEqual(trophyIdsAt(LAKE_ID));
    expect(unknownHints({}, RIVER_ID).map((h) => h.id)).toEqual(['lantern', 'barbelKing', 'ferryPike']);
    expect(unknownHints({ mossback: {} }).map((h) => h.id)).toEqual(['goldenTench', 'silverGhost']);
    for (const h of unknownHints({})) expect(h.text.length).toBeGreaterThan(20);
  });
});

describe('trophy species data', () => {
  it('every trophy has a rule, a half-hint and a where-line; the log card says it in words', () => {
    for (const id of TROPHY_IDS) {
      const sp = speciesById(id)!;
      expect(sp.rarity).toBe('trophy');
      expect(sp.logHint).toBeTruthy();
      expect(whereWhen(sp)).toBe(rule(id).where);
    }
  });
});

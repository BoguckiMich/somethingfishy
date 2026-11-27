import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../art/raster';
import { weatherEffects } from './daily/weather';
import { fishOfTheDay } from './daily/fotd';
import { POOL_SPECIES, SPECIES, speciesById } from './data/fish';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { WEATHER_IDS } from './data/weather';
import { candidates, pickSpecies, rollHookedFish, rollLength, spawnWeight } from './fish';
import { placesOf, wherePlaces, whereWhen, lockedHint } from './fishLog';
import { newPlayer } from './inventory';
import { canBiteWithin, poolAt, zoneAt, type Location } from './location';
import { withPlace } from './place';
import { retargetQuests, rollQuest } from './quests/quests';
import { knowledgeRows } from './fishKnowledge';
import { starFor } from './data/stars';
import { weightG } from './fish';

const TIMES = ['dawn', 'day', 'dusk', 'night'] as const;
const RIVER_IDS = ['trout', 'grayling', 'nase', 'chub', 'barbel', 'vimba'];
const SHARED = ['asp', 'perch', 'pike'];
const mid = (l: Location, i: number) => (l.zones[i].fromM + l.zones[i].toM) / 2;

/** Every species that can bite in a zone of the location at that hour, over every weather. */
function biters(l: Location, zoneIndex: number, time: (typeof TIMES)[number]): Set<string> {
  const z = l.zones[zoneIndex];
  const pool = poolAt(l, mid(l, zoneIndex));
  const out = new Set<string>();
  for (const w of [undefined, ...WEATHER_IDS]) {
    for (const s of candidates(z.fishZone, time, w ? weatherEffects(w, 12 * 60) : undefined, pool)) out.add(s.id);
  }
  return out;
}

describe('the six river species (slice 25d)', () => {
  it('exist with the table values of RIVER_BEND.md section 5', () => {
    const row = (id: string) => {
      const s = speciesById(id)!;
      return [s.zone === 'deep' ? 'deep' : 'shallow', s.times.join(','), s.rarity, s.pattern, (s.likes ?? []).join(',')];
    };
    expect(row('trout')).toEqual(['shallow', 'dawn,dusk', 'uncommon', 'darting', 'rain,overcast']);
    expect(row('grayling')).toEqual(['shallow', 'day', 'uncommon', 'floater', 'sunny']);
    expect(row('nase')).toEqual(['shallow', 'day', 'common', 'smooth', 'sunny']);
    expect(row('chub')).toEqual(['shallow', 'dawn,day,dusk,night', 'common', 'smooth', '']);
    expect(row('barbel')).toEqual(['deep', 'dusk,night', 'uncommon', 'sinker', 'rain']);
    expect(row('vimba')).toEqual(['shallow', 'dawn,day', 'uncommon', 'smooth', 'overcast']);
  });

  it('have realistic sizes and weights, and the cheap nase and chub are the cheapest', () => {
    const w = (id: string, cm: number) => weightG(speciesById(id)!, cm);
    expect(w('trout', 50)).toBeGreaterThan(1200);
    expect(w('trout', 50)).toBeLessThan(1800);
    expect(w('grayling', 40)).toBeGreaterThan(500);
    expect(w('grayling', 40)).toBeLessThan(700);
    expect(w('nase', 35)).toBeGreaterThan(400);
    expect(w('nase', 35)).toBeLessThan(600);
    expect(w('chub', 50)).toBeGreaterThan(1700);
    expect(w('chub', 50)).toBeLessThan(2300);
    expect(w('barbel', 70)).toBeGreaterThan(3500);
    expect(w('barbel', 70)).toBeLessThan(4500);
    expect(w('vimba', 35)).toBeGreaterThan(450);
    expect(w('vimba', 35)).toBeLessThan(650);
    const price = (id: string) => speciesById(id)!.basePrice;
    expect(price('nase')).toBeLessThanOrEqual(price('chub'));
    expect(price('chub')).toBeLessThan(Math.min(price('trout'), price('grayling'), price('barbel'), price('vimba')));
    for (const id of RIVER_IDS) expect(speciesById(id)!.plural ?? speciesById(id)!.name).toBeTruthy();
  });

  it('every river species is a pool species with a fact, and the chub keeps the wink of story R5', () => {
    for (const id of RIVER_IDS) {
      expect(POOL_SPECIES.map((s) => s.id)).toContain(id);
      expect(speciesById(id)!.fact.length).toBeGreaterThan(20);
    }
    expect(speciesById('chub')!.fact).toContain('winked');
  });
});

describe('spawn tables per place and zone', () => {
  it('Quiet Lake never bites a river species (any zone, hour, weather, bait or seed)', () => {
    QUIET_LAKE.zones.forEach((z, i) => {
      for (const t of TIMES) for (const id of biters(QUIET_LAKE, i, t)) expect(RIVER_IDS, `${z.id} ${t}`).not.toContain(id);
    });
    for (let seed = 1; seed < 500; seed++) {
      const zone = seed % 2 ? 'deep' : 'shallow';
      const hooked = rollHookedFish(zone, TIMES[seed % 4], mulberry32(seed), undefined, { distanceM: zone === 'deep' ? 25 : 8, minute: 12 * 60 }, ['worm', 'corn', 'strip'][seed % 3], undefined, undefined, QUIET_LAKE.fishPool);
      expect(RIVER_IDS).not.toContain(hooked.speciesId);
    }
  });

  it('the riffle bites trout, grayling, nase and chub only, by their hours', () => {
    for (const t of TIMES) {
      const b = biters(RIVER_BEND, 0, t);
      for (const id of b) expect(['trout', 'grayling', 'nase', 'chub', 'barbel'], `riffle ${t}`).toContain(id);
      expect(b.has('chub')).toBe(true);
    }
    expect(biters(RIVER_BEND, 0, 'dawn').has('trout')).toBe(true);
    expect(biters(RIVER_BEND, 0, 'day').has('grayling')).toBe(true);
    expect(biters(RIVER_BEND, 0, 'day').has('nase')).toBe(true);
    // (an overcast day lets the trout bite at any hour, like the lake's tench; only the plain hours are checked here)
    expect(candidates('shallow', 'day', undefined, poolAt(RIVER_BEND, 5)).map((s) => s.id)).not.toContain('trout');
  });

  it('the seam bites chub, asp (by day), barbel (dusk and night) and vimba, nothing else', () => {
    for (const t of TIMES) for (const id of biters(RIVER_BEND, 1, t)) expect(['chub', 'asp', 'barbel', 'vimba'], `seam ${t}`).toContain(id);
    expect(biters(RIVER_BEND, 1, 'day').has('asp')).toBe(true);
    expect(biters(RIVER_BEND, 1, 'dusk').has('barbel')).toBe(true);
    expect(biters(RIVER_BEND, 1, 'day').has('barbel')).toBe(false);
    expect(biters(RIVER_BEND, 1, 'dawn').has('vimba')).toBe(true);
  });

  it('the bend pool bites barbel, chub and the visitors perch and pike, nothing else', () => {
    for (const t of TIMES) for (const id of biters(RIVER_BEND, 2, t)) expect(['barbel', 'chub', 'perch', 'pike'], `pool ${t}`).toContain(id);
    expect(biters(RIVER_BEND, 2, 'night').has('barbel')).toBe(true);
    expect(biters(RIVER_BEND, 2, 'day').has('perch')).toBe(true);
    expect(biters(RIVER_BEND, 2, 'day').has('pike')).toBe(true);
  });

  it('no lake species bites at the river except the shared asp, perch and pike', () => {
    const lakeOnly = POOL_SPECIES.map((s) => s.id).filter((id) => !RIVER_IDS.includes(id) && !SHARED.includes(id));
    RIVER_BEND.zones.forEach((_z, i) => {
      for (const t of TIMES) for (const id of biters(RIVER_BEND, i, t)) expect(lakeOnly).not.toContain(id);
    });
    for (let seed = 1; seed < 800; seed++) {
      const d = (seed * 7) % 40;
      const z = zoneAt(RIVER_BEND, d);
      const hooked = rollHookedFish(z.fishZone, TIMES[seed % 4], mulberry32(seed), undefined, { distanceM: d, minute: 23 * 60 }, undefined, undefined, weatherEffects(WEATHER_IDS[seed % 5], 23 * 60), poolAt(RIVER_BEND, d));
      expect([...RIVER_IDS, ...SHARED]).toContain(hooked.speciesId);
      expect(Object.keys(z.fishPool ?? {})).toContain(hooked.speciesId);
    }
  });

  it('every zone and hour has something to bite (no fallback to the lake)', () => {
    RIVER_BEND.zones.forEach((z, i) => {
      for (const t of TIMES) {
        for (let seed = 1; seed <= 30; seed++) {
          const s = pickSpecies(z.fishZone, t, mulberry32(seed), undefined, undefined, undefined, poolAt(RIVER_BEND, mid(RIVER_BEND, i)));
          expect(Object.keys(z.fishPool!), `${z.id} ${t}`).toContain(s.id);
        }
      }
    });
  });

  it('asp is common at the seam, the chub is small in the riffle and big in the bend pool', () => {
    const count = (d: number, id: string) => {
      let n = 0;
      for (let seed = 1; seed <= 600; seed++) if (pickSpecies('shallow', 'day', mulberry32(seed), undefined, undefined, undefined, poolAt(RIVER_BEND, d)).id === id) n++;
      return n;
    };
    expect(count(18, 'asp')).toBeGreaterThan(150);
    const chub = speciesById('chub')!;
    const avg = (d: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 400; seed++) sum += rollLength(chub, mulberry32(seed), poolAt(RIVER_BEND, d));
      return sum / 400;
    };
    expect(avg(5)).toBeLessThan(avg(18));
    expect(avg(18)).toBeLessThan(avg(33));
    expect(avg(5)).toBeLessThan(27);
    expect(avg(33)).toBeGreaterThan(34);
  });
});

describe('daily quests and the fish of the day follow the place', () => {
  it('a river quest only asks for a fish that can bite where her rod lands', () => {
    for (const [rodId, reach] of [['bamboo', 14], ['fiberglass', 26], ['carbon', 40]] as const) {
      const here = withPlace({ ...newPlayer(), rodId }, 'river-bend');
      for (let seed = 1; seed < 120; seed++) {
        const q = rollQuest('catchSpecies', here, mulberry32(seed));
        const sp = speciesById(q.params.speciesId as string)!;
        expect(canBiteWithin(RIVER_BEND, sp, reach), `${rodId} ${sp.id}`).toBe(true);
        // The slow-water visitors live in the bend pool, which only the carbon rod reaches.
        if (reach < 40) expect(['perch', 'pike']).not.toContain(sp.id);
      }
    }
  });

  it('a lake quest never asks for a river species', () => {
    const here = { ...newPlayer(), rodId: 'carbon' };
    for (let seed = 1; seed < 200; seed++) expect(RIVER_IDS).not.toContain(rollQuest('catchSpecies', here, mulberry32(seed)).params.speciesId);
  });

  it('the fish of the day comes from the place she is at, within her reach', () => {
    for (const rodId of ['bamboo', 'fiberglass', 'carbon']) {
      const river = withPlace({ ...newPlayer(), rodId }, 'river-bend');
      const lake = { ...newPlayer(), rodId };
      const seen = new Set<string>();
      for (let d = 1; d <= 28; d++) {
        const day = `2026-12-${String(d).padStart(2, '0')}`;
        const r = fishOfTheDay(day, river)!;
        const l = fishOfTheDay(day, lake)!;
        seen.add(r.id);
        expect(canBiteWithin(RIVER_BEND, r, { bamboo: 14, fiberglass: 26, carbon: 40 }[rodId]!)).toBe(true);
        expect(RIVER_IDS).not.toContain(l.id);
      }
      expect(seen.size).toBeGreaterThan(2);
    }
  });
});

describe('the fish log is one book', () => {
  it('counts the river species too (29 in all) and each species names its places', () => {
    expect(SPECIES).toHaveLength(29);
    expect(SPECIES.filter((s) => s.rarity !== 'legendary' && s.rarity !== 'trophy')).toHaveLength(21);
    for (const id of RIVER_IDS) expect(wherePlaces(speciesById(id)!), id).toBe('River bend');
    for (const id of SHARED) expect(placesOf(speciesById(id)!)).toEqual(['Quiet Lake', 'River bend']);
    expect(wherePlaces(speciesById('perch')!)).toBe('Quiet Lake: shallow water · River bend: deep pool (long cast)');
    expect(wherePlaces(speciesById('asp')!)).toBe('Quiet Lake · River bend');
    expect(wherePlaces(speciesById('pike')!)).toBe('Quiet Lake · River bend');
    expect(placesOf(speciesById('roach')!)).toEqual(['Quiet Lake']);
    expect(placesOf(speciesById('carp')!)).toEqual(['Quiet Lake']);
    expect(placesOf(speciesById('mossback')!)).toEqual(['Quiet Lake']);
    expect(placesOf(speciesById('pale')!)).toEqual(['Quiet Lake']);
    for (const id of ['lantern', 'barbelKing', 'ferryPike', 'ferryman']) expect(placesOf(speciesById(id)!), id).toEqual(['River bend']);
  });

  it('a river species says its bands, and shared and lake species keep their old text', () => {
    expect(whereWhen(speciesById('trout')!)).toBe('Shallows (short cast) · dawn, dusk');
    expect(whereWhen(speciesById('barbel')!)).toBe('Shallows (short cast), Middle of the river, Deep pool (long cast) · dusk, night');
    expect(whereWhen(speciesById('chub')!)).toBe('Shallows (short cast), Middle of the river, Deep pool (long cast) · any time');
    expect(whereWhen(speciesById('carp')!)).toBe('Deep water · any time');
    expect(whereWhen(speciesById('asp')!)).toBe('Shallow water · day');
    expect(lockedHint(speciesById('grayling')!).text).toBe('Shallows (short cast) · by day');
  });

  it('knowledge rows, stars and the gold length work for the new fish', () => {
    for (const id of RIVER_IDS) {
      const s = speciesById(id)!;
      expect(knowledgeRows(s, 30).every((r) => r.unlocked && r.text.length > 0), id).toBe(true);
      expect(starFor(s, s.lengthCm[1])).toBe('gold');
      expect(starFor(s, s.lengthCm[0])).toBe('none');
    }
    expect(knowledgeRows(speciesById('chub')!, 10).some((r) => r.kind === 'weather')).toBe(false);
    expect(knowledgeRows(speciesById('trout')!, 10).find((r) => r.kind === 'weather')?.weatherIds).toEqual(['rain', 'overcast']);
  });
});

describe('no species dominates a river band', () => {
  it('shares of the catches per zone and hour (plain weather): the chub is filler, never a third of the pool', () => {
    const shares = (d: number, t: (typeof TIMES)[number]) => {
      const pool = poolAt(RIVER_BEND, d);
      const cs = candidates(zoneAt(RIVER_BEND, d).fishZone, t, undefined, pool);
      const w = cs.map((s) => spawnWeight(s, undefined, undefined, undefined, pool));
      const total = w.reduce((a, b) => a + b, 0);
      return Object.fromEntries(cs.map((s, i) => [s.id, w[i] / total]));
    };
    for (const d of [5, 18, 33]) {
      for (const t of TIMES) {
        const sh = shares(d, t);
        const max = Math.max(...Object.values(sh));
        // The riffle at night has only the chub and the barbel to offer; every other hour stays under 60 %.
        expect(max, `${d} m ${t} ${JSON.stringify(sh)}`).toBeLessThanOrEqual(d === 5 && t === 'night' ? 0.65 : 0.6);
        if (d === 33) expect(sh.chub ?? 0, `pool ${t}`).toBeLessThan(0.3);
      }
    }
    expect(shares(33, 'night').perch).toBeGreaterThan(0.1);
    expect(shares(33, 'night').pike).toBeGreaterThan(0.1);
    expect(shares(5, 'dusk').trout).toBeGreaterThan(0.25);
    expect(shares(18, 'dusk').barbel).toBeGreaterThan(0.4);
  });
});

describe('quests rolled at the lake, read at the river', () => {
  it('an unfinished species quest for a lake fish is swapped for one that bites at the river; done ones and other kinds stay', () => {
    const base = { ...newPlayer(), rodId: 'carbon' };
    const quest = (speciesId: string, done = false) => ({ kind: 'catchSpecies' as const, params: { target: 2, speciesId }, progress: done ? 2 : 0, done, claimed: false, reward: { coins: 10, worms: 0 } });
    const here = withPlace({ ...base, quests: { date: '2026-12-01', rerollUsed: false, list: [quest('roach'), quest('carp', true), quest('trout')] } }, 'river-bend');
    const fixed = retargetQuests(here).quests!.list;
    expect(RIVER_IDS.concat(SHARED)).toContain(fixed[0].params.speciesId);
    expect(fixed[1].params.speciesId).toBe('carp');
    expect(fixed[2].params.speciesId).toBe('trout');
    const again = { ...here, quests: { ...here.quests!, list: [fixed[2]] } };
    expect(retargetQuests(again)).toBe(again);
  });
});

import { describe, expect, it } from 'vitest';
import { BED_POS, FIRE_FEET, LIGHT_POLE, SOCK_FEET, TENT_FEET } from '../art/campLayout';
import { DOCK } from '../art/layout';
import { PLAY_AREA } from '../scenes/companions/behaviour';
import { fishOfTheDay } from './daily/fotd';
import { weatherEffects } from './daily/weather';
import { POOL_SPECIES, SPECIES, speciesById } from './data/fish';
import { LOCATIONS, QUIET_LAKE, RIVER_BEND, locationById } from './data/locations';
import { candidates, pickSpecies, rollHookedFish } from './fish';
import { livesAt, reachableFishZones, zoneAt } from './location';
import { newPlayer } from './inventory';
import { canTravel, locationOf, normalizePlace, placeOf, withPlace } from './place';
import { rollQuest } from './quests/quests';
import { mulberry32 } from '../art/raster';
import { loadSave, newSave, writeSave, SAVE_KEY } from './save';

describe('Quiet Lake as data reproduces what the scene used to hard-code', () => {
  it('keeps the zones, the reach and the names', () => {
    expect(QUIET_LAKE.id).toBe('quiet-lake');
    expect(QUIET_LAKE.maxDistanceM).toBe(40);
    expect(QUIET_LAKE.zones).toEqual([
      { id: 'shallow', name: 'Shallow water', fromM: 0, toM: 15, fishZone: 'shallow' },
      { id: 'deep', name: 'Deep water', fromM: 15, toM: 40, fishZone: 'deep' },
    ]);
  });

  it('keeps every spot where the scene had it', () => {
    const s = QUIET_LAKE.spots;
    expect(s.car).toEqual({ x: 0, y: 500 });
    expect(s.carHit).toEqual({ x: 0, y: 494, w: 84, h: 58 });
    expect(s.sign).toEqual({ x: 276, y: 498 });
    expect(s.crate).toEqual({ x: 214, y: 458 });
    expect(s.trophy).toEqual({ x: 58, y: 492 });
    expect(s.lantern).toEqual({ x: 180, y: 388 });
    expect(s.dock).toEqual({ x: DOCK.x, y: DOCK.y });
    expect(s.camp).toEqual({ tent: TENT_FEET, pole: LIGHT_POLE, fire: FIRE_FEET, bed: BED_POS, sock: SOCK_FEET });
    expect(s.playArea).toEqual(PLAY_AREA);
  });

  it('lets every pool species bite with the plain weight, and the trophies and the legendary stay possible', () => {
    expect(Object.keys(QUIET_LAKE.fishPool.species).sort()).toEqual(POOL_SPECIES.map((x) => x.id).sort());
    expect(Object.values(QUIET_LAKE.fishPool.species).every((w) => w === 1)).toBe(true);
    expect(QUIET_LAKE.fishPool.specials).toBe(true);
  });

  it('rolls exactly the same fish with and without the pool', () => {
    for (const zone of ['shallow', 'deep'] as const) {
      for (const time of ['dawn', 'day', 'dusk', 'night'] as const) {
        for (let seed = 1; seed < 40; seed++) {
          const a = pickSpecies(zone, time, mulberry32(seed), undefined, undefined, undefined, undefined).id;
          const b = pickSpecies(zone, time, mulberry32(seed), undefined, undefined, undefined, QUIET_LAKE.fishPool).id;
          expect(b).toBe(a);
        }
      }
    }
    const a = rollHookedFish('deep', 'night', mulberry32(5), undefined, { distanceM: 30, minute: 23 * 60 });
    const b = rollHookedFish('deep', 'night', mulberry32(5), undefined, { distanceM: 30, minute: 23 * 60 }, undefined, undefined, undefined, QUIET_LAKE.fishPool);
    expect(b).toEqual(a);
  });

  it('moments, checklist and story belong to the lake', () => {
    expect([QUIET_LAKE.momentsId, QUIET_LAKE.checklistId, QUIET_LAKE.storyPlaceId]).toEqual(['lake', 'quiet-lake', 'quiet-lake']);
  });
});

describe('River bend (placeholder)', () => {
  it('has the riffle, seam and pool bands, contiguous out to its reach', () => {
    expect(RIVER_BEND.zones.map((z) => [z.id, z.fromM, z.toM])).toEqual([['riffle', 0, 12], ['seam', 12, 26], ['pool', 26, 40]]);
    expect(RIVER_BEND.zones[2].toM).toBe(RIVER_BEND.maxDistanceM);
    expect(zoneAt(RIVER_BEND, 5).id).toBe('riffle');
    expect(zoneAt(RIVER_BEND, 12).id).toBe('seam');
    expect(zoneAt(RIVER_BEND, 30).fishZone).toBe('deep');
  });

  it('only has species that exist and are shared with the lake, with no trophies or legendary', () => {
    for (const id of Object.keys(RIVER_BEND.fishPool.species)) expect(POOL_SPECIES.map((s) => s.id)).toContain(id);
    expect(RIVER_BEND.fishPool.specials).toBe(false);
    expect(RIVER_BEND.momentsId).toBeNull();
    expect(RIVER_BEND.checklistId).toBeNull();
  });

  it('only ever bites its own species, and never a trophy or the Pale One, even in the lake conditions for them', () => {
    const allowed = Object.keys(RIVER_BEND.fishPool.species);
    for (let seed = 1; seed < 400; seed++) {
      const rng = mulberry32(seed);
      const zone = seed % 2 ? 'deep' : 'shallow';
      const time = (['dawn', 'day', 'dusk', 'night'] as const)[seed % 4];
      const hooked = rollHookedFish(zone, time, rng, undefined, { distanceM: 30, minute: 23 * 60 }, undefined, undefined, weatherEffects('fog', 23 * 60), RIVER_BEND.fishPool);
      expect(allowed).toContain(hooked.speciesId);
      expect(['pale', 'goldenTench', 'mossback', 'silverGhost']).not.toContain(hooked.speciesId);
    }
  });

  it('applies the place weights (asp is common here)', () => {
    const shallow = candidates('shallow', 'day', undefined, RIVER_BEND.fishPool).map((s) => s.id);
    expect(shallow).toEqual(expect.arrayContaining(['asp', 'perch', 'roach']));
    expect(shallow).not.toContain('tench');
  });

  it('picks the fish of the day and quest species from the place she is at', () => {
    const here = withPlace({ ...newPlayer(), rodId: 'carbon' }, 'river-bend');
    for (let d = 1; d <= 28; d++) {
      const day = `2026-12-${String(d).padStart(2, '0')}`;
      const f = fishOfTheDay(day, here);
      expect(f && livesAt(RIVER_BEND, f.id)).toBe(true);
    }
    for (let seed = 1; seed < 60; seed++) {
      const q = rollQuest('catchSpecies', here, mulberry32(seed));
      expect(livesAt(RIVER_BEND, q.params.speciesId as string)).toBe(true);
    }
  });

  it('reaches shallow with a short rod and deep only past the pool edge', () => {
    expect(reachableFishZones(RIVER_BEND, 14)).toEqual(['shallow']);
    expect(reachableFishZones(RIVER_BEND, 26)).toEqual(['shallow']);
    expect(reachableFishZones(RIVER_BEND, 40)).toEqual(['shallow', 'deep']);
    expect(reachableFishZones(QUIET_LAKE, 14)).toEqual(['shallow']);
    expect(reachableFishZones(QUIET_LAKE, 40)).toEqual(['shallow', 'deep']);
  });
});

describe('the place in the player state', () => {
  it('defaults to Quiet Lake and normalises junk', () => {
    expect(placeOf(newPlayer())).toBe('quiet-lake');
    expect(normalizePlace('nowhere')).toBe('quiet-lake');
    expect(normalizePlace(7)).toBe('quiet-lake');
    expect(locationById(undefined)).toBe(QUIET_LAKE);
    expect(LOCATIONS.map((l) => l.id)).toEqual(['quiet-lake', 'river-bend']);
  });

  it('stores only the river, and Quiet Lake leaves no key', () => {
    const p = withPlace(newPlayer(), 'river-bend');
    expect(p.place).toBe('river-bend');
    expect(locationOf(p)).toBe(RIVER_BEND);
    expect('place' in withPlace(p, 'quiet-lake')).toBe(false);
  });

  it('survives a save and load, and an unknown place loads as Quiet Lake', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } as unknown as Storage;
    const save = { ...newSave(), player: withPlace(newPlayer(), 'river-bend') };
    expect(writeSave(store, save)).toBe(true);
    expect(loadSave(store).save.player.place).toBe('river-bend');
    const raw = JSON.parse(mem.get(SAVE_KEY)!);
    raw.player.place = 'atlantis';
    mem.set(SAVE_KEY, JSON.stringify(raw));
    expect(loadSave(store).save.player.place).toBeUndefined();
    expect(loadSave(store).save.version).toBe(1);
  });
});

describe('travel rule', () => {
  const calm = { fishing: 'idle', panelOpen: false, fading: false, busy: false };
  it('needs Alex idle and nothing else going on', () => {
    expect(canTravel(calm)).toBe(true);
    expect(canTravel({ ...calm, fishing: 'waiting' })).toBe(false);
    expect(canTravel({ ...calm, fishing: 'fighting' })).toBe(false);
    expect(canTravel({ ...calm, panelOpen: true })).toBe(false);
    expect(canTravel({ ...calm, fading: true })).toBe(false);
    expect(canTravel({ ...calm, busy: true })).toBe(false);
  });
});

describe('data sanity', () => {
  it('every river species exists in the species list', () => {
    for (const id of Object.keys(RIVER_BEND.fishPool.species)) expect(speciesById(id)).toBeDefined();
    expect(SPECIES.length).toBeGreaterThan(Object.keys(RIVER_BEND.fishPool.species).length);
  });
});

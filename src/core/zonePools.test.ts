import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../art/raster';
import { weatherEffects } from './daily/weather';
import { POOL_SPECIES } from './data/fish';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { candidates, pickSpecies, spawnWeight } from './fish';
import { poolAt, zoneAt, type Location } from './location';

const TIMES = ['dawn', 'day', 'dusk', 'night'] as const;
const WEATHERS = ['sunny', 'overcast', 'rain', 'windy', 'fog'] as const;
const mid = (l: Location, i: number) => (l.zones[i].fromM + l.zones[i].toM) / 2;

describe('per-zone fish pools (M2 groundwork A)', () => {
  it('Quiet Lake: every zone and time gives the very same candidates, weights and picks as before (no pool at all)', () => {
    QUIET_LAKE.zones.forEach((z, i) => {
      expect(z.fishPool).toBeUndefined();
      const pool = poolAt(QUIET_LAKE, mid(QUIET_LAKE, i));
      expect(pool).toBe(QUIET_LAKE.fishPool);
      for (const t of TIMES) {
        for (const w of [undefined, ...WEATHERS]) {
          const fx = w ? weatherEffects(w, 12 * 60) : undefined;
          const before = candidates(z.fishZone, t, fx);
          const after = candidates(z.fishZone, t, fx, pool);
          expect(after.map((s) => s.id), `${z.id} ${t} ${w}`).toEqual(before.map((s) => s.id));
          for (const s of before) {
            for (const bait of [undefined, 'corn', 'strip']) {
              expect(spawnWeight(s, bait, undefined, fx, pool)).toBe(spawnWeight(s, bait, undefined, fx));
            }
          }
        }
        for (let seed = 1; seed <= 40; seed++) {
          expect(pickSpecies(z.fishZone, t, mulberry32(seed), undefined, undefined, undefined, pool).id).toBe(pickSpecies(z.fishZone, t, mulberry32(seed)).id);
        }
      }
    });
  });

  it('a zone with its own pool replaces the location pool for casts landing there, and keeps the location trophy flag', () => {
    const fake: Location = {
      ...RIVER_BEND,
      fishPool: { species: { asp: 3, perch: 1 }, specials: true },
      zones: [
        { id: 'a', name: 'A', fromM: 0, toM: 10, fishZone: 'shallow', fishPool: { perch: 5 } },
        { id: 'b', name: 'B', fromM: 10, toM: 40, fishZone: 'deep' },
      ],
    };
    expect(poolAt(fake, 5)).toEqual({ species: { perch: 5 }, specials: true });
    expect(poolAt(fake, 20)).toBe(fake.fishPool);
    const perch = POOL_SPECIES.find((s) => s.id === 'perch')!;
    expect(spawnWeight(perch, undefined, undefined, undefined, poolAt(fake, 5))).toBe(5 * spawnWeight(perch));
  });

  it('River bend: zone pools only use species of the location pool, and every zone and time can produce a fish', () => {
    for (const z of RIVER_BEND.zones) {
      const d = (z.fromM + z.toM) / 2;
      const pool = poolAt(RIVER_BEND, d);
      expect(zoneAt(RIVER_BEND, d)).toBe(z);
      expect(pool.specials).toBe(false);
      for (const id of Object.keys(pool.species)) expect(Object.keys(RIVER_BEND.fishPool.species), `${z.id} ${id}`).toContain(id);
      for (const t of TIMES) {
        for (let seed = 1; seed <= 60; seed++) {
          const s = pickSpecies(z.fishZone, t, mulberry32(seed), undefined, undefined, undefined, pool);
          expect(Object.keys(pool.species), `${z.id} ${t}`).toContain(s.id);
        }
      }
    }
  });

  it('River bend: the seam is where the asp bites, the riffle never has one', () => {
    expect(candidates('shallow', 'day', undefined, poolAt(RIVER_BEND, 18)).map((s) => s.id)).toContain('asp');
    expect(candidates('shallow', 'day', undefined, poolAt(RIVER_BEND, 5)).map((s) => s.id)).not.toContain('asp');
  });
});

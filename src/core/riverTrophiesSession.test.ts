import { describe, expect, it } from 'vitest';
import { timeOfDay } from './clock';
import { STARTER_BAR_GEAR } from './data/barGear';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { RODS } from './data/rods';
import { weatherEffects } from './daily/weather';
import { step, type SessionContext } from './fishingSession';
import { zoneAt } from './location';
import { seededRng } from './random';

/** The river trophies and the Ferryman through the real session: the landed cast carries its place and band (slice 25f). */
const hm = (h: number, m = 0) => h * 60 + m;
type Loc = typeof RIVER_BEND;
type Weather = Parameters<typeof weatherEffects>[0];

const landed = (loc: Loc, distanceM: number, minute: number, weather: Weather, bait: string | undefined, seed: number): string => {
  const zone = zoneAt(loc, distanceM);
  const ctx: SessionContext = {
    location: loc,
    rod: RODS[2],
    barGear: STARTER_BAR_GEAR,
    rng: seededRng(seed),
    timeOfDay: () => timeOfDay(minute),
    minute: () => minute,
    weatherFx: () => weatherEffects(weather, minute),
    baitId: () => bait,
  };
  const r = step({ kind: 'casting', power: 1, distanceM, zone: zone.fishZone }, { type: 'landed' }, ctx);
  return r.state.kind === 'waiting' ? r.state.hooked.speciesId : '';
};

const share = (loc: Loc, distanceM: number, minute: number, weather: Weather, bait: string | undefined, id: string): number =>
  Array.from({ length: 800 }, (_, i) => landed(loc, distanceM, minute, weather, bait, i + 1)).filter((s) => s === id).length / 800;

describe('through the session', () => {
  it('the Lantern, the Barbel King, the Ferry pike and the Ferryman bite at the river in their conditions', () => {
    expect(share(RIVER_BEND, 6, hm(23), 'rain', 'maggots', 'lantern')).toBeGreaterThan(0.15);
    expect(share(RIVER_BEND, 33, hm(18, 30), 'overcast', 'strip', 'barbelKing')).toBeGreaterThan(0.1);
    expect(share(RIVER_BEND, 22, hm(13), 'windy', undefined, 'ferryPike')).toBeGreaterThan(0.15);
    expect(share(RIVER_BEND, 35, hm(18, 30), 'sunny', undefined, 'ferryman')).toBeGreaterThan(0.2);
  });

  it('never outside them: the wrong band, the wrong distance, the lake', () => {
    expect(share(RIVER_BEND, 14, hm(13), 'windy', undefined, 'ferryPike')).toBe(0); // the seam, but short of the rope
    expect(share(RIVER_BEND, 26, hm(13), 'windy', undefined, 'ferryPike')).toBe(0); // the pool begins
    expect(share(RIVER_BEND, 22, hm(13), 'sunny', undefined, 'ferryPike')).toBe(0);
    expect(share(RIVER_BEND, 28, hm(18, 30), 'sunny', undefined, 'ferryman')).toBe(0); // the fiberglass rod's reach
    expect(share(QUIET_LAKE, 35, hm(18, 30), 'sunny', undefined, 'ferryman')).toBe(0);
    for (const id of ['lantern', 'barbelKing', 'ferryPike']) expect(share(QUIET_LAKE, 22, hm(13), 'windy', 'strip', id)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { STARTER_BAR_GEAR } from './data/barGear';
import { PALE_ONE } from './data/legendary';
import { QUIET_LAKE } from './data/locations';
import { RODS } from './data/rods';
import { POOL_SPECIES, speciesById } from './data/fish';
import { candidates, rollHookedFish } from './fish';
import { INITIAL_STATE, step, type FishingInput, type FishingState, type SessionContext } from './fishingSession';
import { CHARGE_HALF_CYCLE_MS } from './casting';
import { inPaleWindow, paleCanSpawn, rollLegendary, slipsAway } from './legendary';
import { seededRng } from './random';

const hm = (h: number, m = 0) => h * 60 + m;

describe('the Pale One window', () => {
  it('is 02:00 to 04:00, end exclusive, and wraps around the day', () => {
    expect(inPaleWindow(hm(1, 59))).toBe(false);
    expect(inPaleWindow(hm(2))).toBe(true);
    expect(inPaleWindow(hm(3, 30))).toBe(true);
    expect(inPaleWindow(hm(3, 59.9))).toBe(true);
    expect(inPaleWindow(hm(4))).toBe(false);
    expect(inPaleWindow(hm(12))).toBe(false);
    expect(inPaleWindow(1440 + hm(3))).toBe(true);
    expect(inPaleWindow(-hm(21))).toBe(true); // 03:00 the day before
  });

  it('needs the bobber at 30 m or more as well', () => {
    expect(paleCanSpawn(30, hm(3))).toBe(true);
    expect(paleCanSpawn(40, hm(3))).toBe(true);
    expect(paleCanSpawn(29.9, hm(3))).toBe(false);
    expect(paleCanSpawn(40, hm(12))).toBe(false);
    expect(PALE_ONE.minDistanceM).toBe(30);
  });
});

describe('rolling the legendary', () => {
  it('never appears outside the conditions, and does not touch the rng there', () => {
    const rng = seededRng(3);
    const spy = () => {
      throw new Error('rng must not be drawn');
    };
    expect(rollLegendary(25, hm(3), spy)).toBeUndefined();
    expect(rollLegendary(40, hm(5), spy)).toBeUndefined();
    for (let i = 0; i < 500; i++) {
      expect(rollLegendary(29, hm(3), rng)).toBeUndefined();
      expect(rollLegendary(40, hm(1), rng)).toBeUndefined();
    }
  });

  it('appears about 25% of landed casts inside the window, deterministic for a seed', () => {
    const rng = seededRng(11);
    let hits = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) if (rollLegendary(35, hm(3), rng)?.id === 'pale') hits++;
    expect(hits / n).toBeGreaterThan(0.22);
    expect(hits / n).toBeLessThan(0.28);
    const a = Array.from({ length: 50 }, ((r) => () => !!rollLegendary(35, hm(3), r))(seededRng(5)));
    const b = Array.from({ length: 50 }, ((r) => () => !!rollLegendary(35, hm(3), r))(seededRng(5)));
    expect(a).toEqual(b);
  });

  it('is not part of the normal pool', () => {
    expect(POOL_SPECIES.map((s) => s.id)).not.toContain('pale');
    for (const t of ['dawn', 'day', 'dusk', 'night'] as const) expect(candidates('deep', t).map((s) => s.id)).not.toContain('pale');
  });

  it('rollHookedFish swaps it in only with a place, and sizes it in its range', () => {
    let seen = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const h = rollHookedFish('deep', 'night', seededRng(seed), undefined, { distanceM: 36, minute: hm(3) });
      if (h.speciesId === 'pale') {
        seen++;
        const sp = speciesById('pale')!;
        expect(h.lengthCm).toBeGreaterThanOrEqual(sp.lengthCm[0]);
        expect(h.lengthCm).toBeLessThanOrEqual(sp.lengthCm[1]);
        expect(h.weightG).toBeGreaterThan(30_000);
      }
      expect(rollHookedFish('deep', 'night', seededRng(seed)).speciesId).not.toBe('pale');
    }
    expect(seen).toBeGreaterThan(20);
    expect(seen).toBeLessThan(80);
  });

  it('slips away (no bag, no coins) only for legendaries', () => {
    expect(slipsAway('pale')).toBe(true);
    expect(slipsAway('catfish')).toBe(false);
    expect(slipsAway('nope')).toBe(false);
  });
});

describe('the session picks it on landing', () => {
  const carbon = RODS[2];
  const ctx = (minute: number | undefined, seed: number): SessionContext => ({
    location: QUIET_LAKE,
    rod: carbon,
    barGear: STARTER_BAR_GEAR,
    rng: seededRng(seed),
    timeOfDay: () => 'night',
    minute: minute === undefined ? undefined : () => minute,
  });
  const cast: FishingInput[] = [{ type: 'press' }, { type: 'tick', dtMs: CHARGE_HALF_CYCLE_MS }, { type: 'release' }, { type: 'landed' }];
  const landedSpecies = (c: SessionContext): string | null => {
    let s: FishingState = INITIAL_STATE;
    for (const i of cast) s = step(s, i, c).state;
    return s.kind === 'waiting' ? s.hooked.speciesId : null;
  };

  it('at 40 m in the window some seeds hook it, at the wrong time or without a clock none do', () => {
    const inWindow = Array.from({ length: 120 }, (_, i) => landedSpecies(ctx(hm(3), i + 1)));
    expect(inWindow.filter((id) => id === 'pale').length).toBeGreaterThan(10);
    const noon = Array.from({ length: 120 }, (_, i) => landedSpecies(ctx(hm(12), i + 1)));
    expect(noon).not.toContain('pale');
    const noClock = Array.from({ length: 120 }, (_, i) => landedSpecies(ctx(undefined, i + 1)));
    expect(noClock).not.toContain('pale');
  });
});

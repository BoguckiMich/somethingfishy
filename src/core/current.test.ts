import { describe, expect, it } from 'vitest';
import { STARTER_BAR_GEAR } from './data/barGear';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { RODS } from './data/rods';
import { advanceDrift, biteRate, driftPos, EASE_FROM, fightEveryMul, RIVER_CURRENT as C } from './current';
import { beginFight } from './fight';
import { step, type FishingState, type SessionContext } from './fishingSession';
import type { HookedFish } from './fish';
import type { FishProfile } from './catchBar';
import { newLineFight, tickLineFight } from './lineFight';
import { seededRng } from './random';
import { weatherEffects } from './daily/weather';

const PERCH: HookedFish = { speciesId: 'perch', lengthCm: 24, weightG: 210 };
const SEC = 1000;

describe('drift progress', () => {
  it('runs `runS` seconds at flow 1 and stops at exactly 1', () => {
    let d = 0;
    let ms = 0;
    while (d < 1 && ms < 120 * SEC) {
      d = advanceDrift(d, 16, 1, C);
      ms += 16;
    }
    expect(d).toBe(1);
    expect(ms / SEC).toBeGreaterThan(C.runS - 0.1);
    expect(ms / SEC).toBeLessThan(C.runS + 0.1);
    expect(advanceDrift(1, 5000, 1, C)).toBe(1);
  });

  it('scales with the flow: rain is faster, the ferry slowdown is slower, no flow stands still', () => {
    const t = (flow: number) => {
      let d = 0;
      let ms = 0;
      while (d < 1) {
        d = advanceDrift(d, 16, flow, C);
        ms += 16;
      }
      return ms / SEC;
    };
    expect(t(1.6)).toBeCloseTo(C.runS / 1.6, 0);
    expect(t(1.6)).toBeLessThan(t(1));
    expect(t(0.5)).toBeGreaterThan(t(1));
    expect(advanceDrift(0.3, 1000, 0, C)).toBe(0.3);
  });

  it('the eased position is steady, then slows to a stop exactly at the eddy', () => {
    expect(driftPos(0)).toBe(0);
    expect(driftPos(1)).toBeCloseTo(1, 10);
    const speed = (t: number) => (driftPos(t + 0.001) - driftPos(t)) / 0.001;
    expect(speed(0.1)).toBeCloseTo(speed(0.5), 5);
    expect(speed(0.9)).toBeLessThan(speed(0.5) * 0.6);
    expect(speed(0.999)).toBeLessThan(0.05);
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.01) {
      expect(driftPos(t)).toBeGreaterThanOrEqual(prev);
      expect(driftPos(t)).toBeLessThanOrEqual(1 + 1e-9);
      prev = driftPos(t);
    }
    expect(EASE_FROM).toBeLessThan(1);
  });
});

describe('bite rate', () => {
  it('seam bites come sooner while the bobber drifts, any band is rarer once it has settled, the rest is 1', () => {
    expect(biteRate(C, 'seam', 0.5)).toBe(C.seamBiteMul);
    expect(biteRate(C, 'seam', 0)).toBe(C.seamBiteMul);
    expect(biteRate(C, 'riffle', 0.5)).toBe(1);
    expect(biteRate(C, 'pool', 0.99)).toBe(1);
    for (const band of ['riffle', 'seam', 'pool']) expect(biteRate(C, band, 1)).toBe(C.eddyBiteMul);
    expect(C.seamBiteMul).toBeGreaterThan(1);
    expect(C.eddyBiteMul).toBeLessThan(1);
  });

  it('still water has no rate change', () => {
    expect(biteRate(undefined, 'seam', 1)).toBe(1);
    expect(biteRate(C, 'seam', undefined)).toBe(1);
  });
});

/** A river session context with a flow. */
function riverCtx(flow: () => number = () => 1): SessionContext {
  return { location: RIVER_BEND, rod: RODS[2], barGear: STARTER_BAR_GEAR, rng: seededRng(1), timeOfDay: () => 'day', flow };
}
const waiting = (distanceM: number, extra: Partial<Extract<FishingState, { kind: 'waiting' }>> = {}): FishingState => ({
  kind: 'waiting', distanceM, zone: distanceM < 26 ? 'shallow' : 'deep', hooked: PERCH, untilMs: 1e9, nibblesLeft: 0, hadNibble: false, drift: 0, ...extra,
});
const drifted = (s: FishingState) => (s as { drift?: number }).drift;

describe('river session', () => {
  it('a landed cast at the river starts at drift 0, at a lake it has no drift at all', () => {
    const casting: FishingState = { kind: 'casting', power: 1, distanceM: 20, zone: 'shallow' };
    expect(drifted(step(casting, { type: 'landed' }, riverCtx()).state)).toBe(0);
    const lake = step(casting, { type: 'landed' }, { ...riverCtx(), location: QUIET_LAKE }).state;
    expect('drift' in lake).toBe(false);
  });

  it('drifts while waiting, faster with the flow, and says once when it settles', () => {
    let state = waiting(8);
    const events: string[] = [];
    const ctx = riverCtx(() => 2);
    let ms = 0;
    while (drifted(state)! < 1 && ms < 200 * SEC) {
      const r = step(state, { type: 'tick', dtMs: 50 }, ctx);
      state = r.state;
      events.push(...r.events.map((e) => e.type));
      ms += 50;
    }
    expect(ms / SEC).toBeCloseTo(C.runS / 2, 0);
    expect(events).toEqual(['driftSettled']);
    // Sitting in the eddy afterwards: nothing more is said and it stays settled.
    const more = step(state, { type: 'tick', dtMs: 5000 }, ctx);
    expect(more.events).toEqual([]);
    expect(drifted(more.state)).toBe(1);
  });

  it('the flow callback is read live: the ferry slowdown slows the run', () => {
    const slow = step(waiting(8), { type: 'tick', dtMs: 3000 }, riverCtx(() => 0.1)).state;
    const normal = step(waiting(8), { type: 'tick', dtMs: 3000 }, riverCtx(() => 1)).state;
    expect(drifted(slow)!).toBeLessThan(drifted(normal)!);
    expect(drifted(normal)!).toBeCloseTo(3 / C.runS, 6);
  });

  it('the countdown runs at the band rate and nothing is re-rolled', () => {
    const at = (distanceM: number, drift: number) => (step(waiting(distanceM, { untilMs: 10_000, drift }), { type: 'tick', dtMs: 1000 }, riverCtx()).state as { untilMs: number }).untilMs;
    expect(at(20, 0.2)).toBeCloseTo(10_000 - 1000 * C.seamBiteMul, 6); // seam, drifting
    expect(at(5, 0.2)).toBeCloseTo(9000, 6); // riffle, drifting
    expect(at(30, 0.2)).toBeCloseTo(9000, 6); // pool, drifting
    expect(at(20, 1)).toBeCloseTo(10_000 - 1000 * C.eddyBiteMul, 6); // eddy, any band
    expect(at(5, 1)).toBeCloseTo(10_000 - 1000 * C.eddyBiteMul, 6);
    const s = step(waiting(20, { untilMs: 10_000, drift: 0.2 }), { type: 'tick', dtMs: 1000 }, riverCtx()).state as Extract<FishingState, { kind: 'waiting' }>;
    expect(s.hooked).toEqual(PERCH);
    expect(s.distanceM).toBe(20);
    expect(s.zone).toBe('shallow');
  });

  it('mean time to the first bite: sooner while drifting in the seam, later in the eddy', () => {
    const mean = (distanceM: number, drift: number) => {
      let total = 0;
      const n = 200;
      for (let seed = 1; seed <= n; seed++) {
        const ctx = { ...riverCtx(() => 0), rng: seededRng(seed) }; // flow 0: the drift stays where it starts
        let state = step({ kind: 'casting', power: 1, distanceM, zone: distanceM < 26 ? 'shallow' : 'deep' }, { type: 'landed' }, ctx).state;
        state = { ...state, drift } as FishingState;
        let ms = 0;
        while (state.kind === 'waiting' && ms < 600_000) {
          state = step(state, { type: 'tick', dtMs: 25 }, ctx).state;
          ms += 25;
        }
        total += ms;
      }
      return total / n;
    };
    const seamDrifting = mean(20, 0);
    const seamSettled = mean(20, 1);
    const riffleDrifting = mean(6, 0);
    const riffleSettled = mean(6, 1);
    expect(seamDrifting).toBeLessThan(riffleDrifting);
    expect(seamSettled).toBeGreaterThan(seamDrifting * 2);
    expect(riffleSettled).toBeGreaterThan(riffleDrifting * 1.8);
  });

  it('the drift is carried through the bite, the fight, a lost fish and the reel-in', () => {
    const bite = step(waiting(20, { untilMs: 1, drift: 0.4 }), { type: 'tick', dtMs: 16 }, riverCtx()).state;
    expect(bite).toMatchObject({ kind: 'bite', drift: 0.4 + 0.016 / C.runS });
    const d = drifted(bite)!;
    expect(drifted(step(bite, { type: 'press' }, { ...riverCtx(), catchStyle: () => 'line' }).state)).toBe(d);
    expect(drifted(step(bite, { type: 'tick', dtMs: 2000 }, riverCtx()).state)).toBe(d); // too late: reeled in
    expect(drifted(step(waiting(20, { drift: 0.6 }), { type: 'press' }, riverCtx()).state)).toBe(0.6);
    const lost: FishingState = { kind: 'lost', distanceM: 20, ageMs: 0, drift: 0.7 };
    expect(step(lost, { type: 'tick', dtMs: 5000 }, riverCtx()).state).toEqual({ kind: 'retrieving', distanceM: 20, drift: 0.7 });
  });

  it('a hooked fish at the river starts its line fight with the river multiplier, in the rain with the rain\'s too', () => {
    const bite = step(waiting(20, { untilMs: 1, drift: 0.4 }), { type: 'tick', dtMs: 16 }, riverCtx()).state;
    const dry = step(bite, { type: 'press' }, { ...riverCtx(), catchStyle: () => 'line' }).state;
    const rain = step(bite, { type: 'press' }, { ...riverCtx(), catchStyle: () => 'line', weatherFx: () => weatherEffects('rain') }).state;
    expect((dry as { line?: { calmMul?: number } }).line?.calmMul).toBe(C.fightEveryMul);
    expect((rain as { line?: { calmMul?: number } }).line?.calmMul).toBeCloseTo(C.fightEveryMul * C.rainFightEveryMul, 10);
    const trophyFish: FishProfile = { pattern: 'darting', difficulty: 0.85, slipAfterMs: 5000 };
    const trophy = step(bite, { type: 'press' }, { ...riverCtx(), catchStyle: () => 'line', fishOverride: trophyFish }).state;
    expect((trophy as { line?: { calmMul?: number } }).line?.calmMul).toBeUndefined();
    const classic = step(bite, { type: 'press' }, riverCtx()).state;
    expect((classic as { line?: unknown }).line).toBeUndefined();
  });
});

describe('Quiet Lake is unchanged', () => {
  it('has no current and its states never carry a drift', () => {
    expect(QUIET_LAKE.current).toBeUndefined();
    const ctx: SessionContext = { location: QUIET_LAKE, rod: RODS[2], barGear: STARTER_BAR_GEAR, rng: seededRng(5), timeOfDay: () => 'day', flow: () => 9, weatherFx: () => weatherEffects('rain') };
    let state = step({ kind: 'casting', power: 1, distanceM: 20, zone: 'shallow' }, { type: 'landed' }, ctx).state;
    let ms = 0;
    while (state.kind === 'waiting') {
      expect('drift' in state).toBe(false);
      state = step(state, { type: 'tick', dtMs: 16 }, ctx).state;
      ms += 16;
    }
    expect(state.kind).toBe('bite');
    expect('drift' in state).toBe(false);
    const hooked = step(state, { type: 'press' }, { ...ctx, catchStyle: () => 'line' }).state;
    expect('drift' in hooked).toBe(false);
    expect((hooked as { line?: { calmMul?: number } }).line?.calmMul).toBeUndefined();
    // Pinned from the code before slice 25c: the same seeded cast bites after the same number of ticks.
    expect(ms).toBe(PIN_MS);
  });
});

const FISH: FishProfile = { pattern: 'darting', difficulty: 0.5 };
describe('river fight surges', () => {
  it('the multiplier is 1 away from the river, the river\'s own, and the rain\'s on top', () => {
    expect(fightEveryMul(undefined, true)).toBe(1);
    expect(fightEveryMul(C, false)).toBe(C.fightEveryMul);
    expect(fightEveryMul(C, true)).toBeCloseTo(C.fightEveryMul * C.rainFightEveryMul, 10);
    expect(fightEveryMul(C, true, true)).toBe(1); // a trophy keeps its own tuning
    expect(C.fightEveryMul).toBeLessThan(1);
  });

  it('the line fight keeps the multiplier only when it is not 1, and Classic ignores it', () => {
    expect(newLineFight(seededRng(1), 10).calmMul).toBeUndefined();
    expect(newLineFight(seededRng(1), 10, undefined, FISH, undefined, 1).calmMul).toBeUndefined();
    expect(newLineFight(seededRng(1), 10, undefined, FISH, undefined, 0.85).calmMul).toBe(0.85);
    const a = beginFight('classic', FISH, STARTER_BAR_GEAR, seededRng(3), 10, 'perch');
    const b = beginFight('classic', FISH, STARTER_BAR_GEAR, seededRng(3), 10, 'perch', 0.5);
    expect(b).toEqual(a);
    expect(beginFight('line', FISH, STARTER_BAR_GEAR, seededRng(3), 10, 'perch').line).toEqual(newLineFight(seededRng(3), 10, 'perch', FISH, STARTER_BAR_GEAR));
  });

  it('only the calm gaps change: the first calm is untouched, the later ones are shorter by about the multiplier', () => {
    const calmGaps = (mul: number | undefined, seed: number) => {
      const rng = seededRng(seed);
      let s = newLineFight(rng, 1000, undefined, FISH, STARTER_BAR_GEAR, mul);
      const first = s.phaseTotal;
      const gaps: number[] = [];
      let inSurge = false;
      for (let i = 0; i < 60_000 / 16 && s.result === 'fighting'; i++) {
        // Pulse the thumb so the fight runs on.
        s = tickLineFight(s, 16, Math.floor(i / 40) % 2 === 0, FISH, STARTER_BAR_GEAR, rng);
        if (s.phase !== 'calm') inSurge = true;
        else if (inSurge) {
          gaps.push(s.phaseTotal);
          inSurge = false;
        }
      }
      return { first, gaps };
    };
    let base = 0;
    let fast = 0;
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const a = calmGaps(undefined, seed);
      const b = calmGaps(0.85, seed);
      expect(b.first).toBe(a.first); // the first calm is `firstSurgeS`, untouched
      for (const g of a.gaps) (base += g), n++;
      for (const g of b.gaps) fast += g;
    }
    expect(n).toBeGreaterThan(150);
    expect(fast / base).toBeGreaterThan(0.75);
    expect(fast / base).toBeLessThan(0.95);
  });
});

const PIN_MS = 6000;

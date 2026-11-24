import { describe, expect, it } from 'vitest';
import {
  POUR_EVERY,
  chairEmpty,
  companionEvent,
  createCompanions,
  holdsCup,
  isSeatedShape,
  isSipShape,
  sipFrameAt,
  sipTotalMs,
  startBedtime,
  startInCar,
  startPlayNow,
  steamShows,
  tickCompanions,
  type Companions,
  type CompanionContext,
  type PajShape,
} from './behaviour';

const rng = () => 0.5;
const busy: CompanionContext = { fishing: 'charging', night: false }; // he stays in the chair (idle would send them off to play after 25 s)
const step = (s: Companions, ms = 50) => tickCompanions(s, ms, busy, rng);

/** The frames of one sip sampled every `dt` ms: `[shape, ms]` runs in order. */
function framesOf(ms: (t: number) => PajShape | null, total: number, dt = 10): [PajShape, number][] {
  const out: [PajShape, number][] = [];
  for (let t = 0; t < total; t += dt) {
    const f = ms(t);
    if (!f) break;
    if (out.length && out[out.length - 1][0] === f) out[out.length - 1][1] += dt;
    else out.push([f, dt]);
  }
  return out;
}

describe("Pajkel's sip (slice 22a)", () => {
  it('goes lift 200 ms, drink 900 ms, lift 200 ms, then it is over (1.3 s)', () => {
    expect(framesOf((t) => sipFrameAt(t, false), 5000)).toEqual([
      ['sipLift', 200],
      ['sipDrink', 900],
      ['sipLift', 200],
    ]);
    expect(sipTotalMs(false)).toBe(1300);
    expect(sipFrameAt(1300, false)).toBeNull();
  });

  it('a pour in front adds reach 300, pour 800, reach 300 (2.7 s in all)', () => {
    expect(framesOf((t) => sipFrameAt(t, true), 5000).map((f) => f[0])).toEqual(['pourReach', 'pour', 'pourReach', 'sipLift', 'sipDrink', 'sipLift']);
    expect(framesOf((t) => sipFrameAt(t, true), 5000).slice(0, 3).map((f) => f[1])).toEqual([300, 800, 300]);
    expect(sipTotalMs(true)).toBe(2700);
    expect(sipFrameAt(2700, true)).toBeNull();
  });

  it('on the dock every 4th sip pours; the others only sip, with the timeline of the pure state machine', () => {
    const s = createCompanions(rng);
    const runs: { shapes: PajShape[]; ms: number }[] = [];
    let cur: { shapes: PajShape[]; ms: number } | null = null;
    for (let t = 0; t < 400_000 && runs.length < 10; t += 10) {
      step(s, 10);
      if (isSipShape(s.paj.shape)) {
        if (!cur) runs.push((cur = { shapes: [], ms: 0 }));
        if (cur.shapes[cur.shapes.length - 1] !== s.paj.shape) cur.shapes.push(s.paj.shape);
        cur.ms += 10;
      } else cur = null;
    }
    runs.pop(); // the last one may be cut off by the loop
    expect(runs.length).toBe(9);
    runs.forEach((r, i) => {
      const pours = (i + 1) % POUR_EVERY === 0;
      expect(r.shapes.includes('pour'), `sip ${i + 1}`).toBe(pours);
      expect(r.shapes.includes('sipDrink')).toBe(true);
      expect(Math.abs(r.ms - sipTotalMs(pours)), `sip ${i + 1} took ${r.ms} ms`).toBeLessThanOrEqual(30);
      // The order inside: the pour (if any) first, then lift, drink, lift.
      expect(r.shapes).toEqual(pours ? ['pourReach', 'pour', 'pourReach', 'sipLift', 'sipDrink', 'sipLift'] : ['sipLift', 'sipDrink', 'sipLift']);
    });
  });

  it('a bite in the middle of the drink snaps him to look at once, and a hooked fish to cheer', () => {
    for (const [event, shape] of [['bite', 'look'], ['hooked', 'cheer']] as const) {
      const s = createCompanions(rng);
      for (let t = 0; t < 60_000 && s.paj.shape !== 'sipDrink'; t += 50) step(s);
      expect(s.paj.shape).toBe('sipDrink');
      companionEvent(s, event);
      expect(s.paj.shape).toBe(shape);
      step(s);
      expect(isSipShape(s.paj.shape)).toBe(false); // the sip does not resume
    }
  });

  it('a sip cut short does not start again straight away', () => {
    const s = createCompanions(rng);
    for (let t = 0; t < 60_000 && s.paj.shape !== 'sipDrink'; t += 50) step(s);
    companionEvent(s, 'bite');
    for (let t = 0; t < 4000; t += 50) step(s);
    expect(s.paj.shape).toBe('sit');
    expect(s.paj.nextSipIn).toBeGreaterThan(0);
  });

  it('the cup steams at his chest or mouth, and only at dawn, dusk and night', () => {
    expect(['sit', 'sipLift', 'sipDrink'].every((x) => holdsCup(x as PajShape))).toBe(true);
    expect(['pour', 'pourReach', 'cheer', 'look', 'walk'].some((x) => holdsCup(x as PajShape))).toBe(false);
    expect(steamShows('day')).toBe(false);
    expect(['dawn', 'dusk', 'night'].every((p) => steamShows(p as 'dawn' | 'dusk' | 'night'))).toBe(true);
  });
});

describe("Pajkel's chair (slice 22a)", () => {
  it('is taken while he sits, empty while they play on the grass, and empty while they sleep in the car', () => {
    const s = createCompanions(rng);
    expect(isSeatedShape(s.paj.shape)).toBe(true);
    expect(chairEmpty(s)).toBe(false);
    startPlayNow(s);
    expect(chairEmpty(s)).toBe(true);
    const car = createCompanions(rng);
    startInCar(car);
    expect(chairEmpty(car)).toBe(true);
  });

  it('is still taken when bedtime starts while he sits there, and empty once he walks off', () => {
    const s = createCompanions(rng);
    startBedtime(s, 'Night night');
    expect(chairEmpty(s)).toBe(false);
    for (let t = 0; t < 30_000 && !chairEmpty(s); t += 50) step(s);
    expect(chairEmpty(s)).toBe(true);
  });
});

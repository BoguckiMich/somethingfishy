import { describe, expect, it } from 'vitest';
import { newPlayer } from './inventory';
import { SKIP_TUNING, flickSpeed, noteSkips, skipPlan, skipText, skipsBestOf, skipsForSpeed, throwFor, type FlickSample } from './skipping';

const DAY1 = '2026-11-26';
const DAY2 = '2026-11-27';

describe('flick speed to skips', () => {
  it('goes from 1 to 5 with the speed and never beyond', () => {
    expect([0, 0.1, 0.3, 0.5, 0.7, 1, 1.2, 1.5, 1.9, 5, 99].map(skipsForSpeed)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5]);
  });

  it('measures the speed over the last 110 ms only', () => {
    const slowThenFast: FlickSample[] = [
      { x: 0, y: 0, t: 0 },
      { x: 10, y: 0, t: 200 },
      { x: 20, y: 0, t: 300 },
      { x: 120, y: 0, t: 350 },
    ];
    // within 110 ms of the end: the samples at t=300 and t=350: 100 px in 50 ms
    expect(flickSpeed(slowThenFast)).toBeCloseTo(2, 5);
    expect(flickSpeed([])).toBe(0);
    expect(flickSpeed([{ x: 0, y: 0, t: 5 }])).toBe(0);
    expect(flickSpeed([{ x: 0, y: 0, t: 5 }, { x: 9, y: 9, t: 5 }])).toBe(0);
  });
});

describe('a tap and a swipe', () => {
  const at = (x: number, y: number, t: number): FlickSample => ({ x, y, t });
  it('a plain tap throws a medium pebble straight out', () => {
    expect(throwFor({ x: 100, y: 460 }, { x: 102, y: 461 }, [])).toEqual({ skips: SKIP_TUNING.tapSkips, side: 0 });
    expect(SKIP_TUNING.tapSkips).toBe(3);
  });

  it('a quick swipe up is a long skipper, a slow drag a short one', () => {
    const fast = [at(100, 460, 0), at(100, 440, 20), at(100, 330, 60)];
    expect(throwFor({ x: 100, y: 460 }, { x: 100, y: 330 }, fast).skips).toBe(5);
    const slow = [at(100, 460, 0), at(100, 440, 400), at(100, 420, 800)];
    expect(throwFor({ x: 100, y: 460 }, { x: 100, y: 420 }, slow).skips).toBe(1);
  });

  it('the sideways part of the swipe says which way it drifts, clamped', () => {
    const s = [at(100, 460, 0), at(300, 450, 50)];
    expect(throwFor({ x: 100, y: 460 }, { x: 300, y: 450 }, s).side).toBe(1);
    expect(throwFor({ x: 100, y: 460 }, { x: 0, y: 450 }, [at(100, 460, 0), at(0, 450, 50)]).side).toBe(-1);
    expect(throwFor({ x: 100, y: 460 }, { x: 120, y: 400 }, [at(100, 460, 0), at(120, 400, 50)]).side).toBeCloseTo(0.25, 5);
  });
});

describe('where it touches the water', () => {
  it('has one touch-down per skip plus the one where it sinks, each farther out and the gaps shrinking', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const plan = skipPlan(n);
      expect(plan).toHaveLength(n + 1);
      expect(plan[0]).toBe(SKIP_TUNING.firstM);
      const gaps = plan.slice(1).map((d, i) => d - plan[i]);
      for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThan(gaps[i - 1]);
      expect(plan[plan.length - 1]).toBeLessThan(25); // on the shallow side of the lake
    }
  });

  it('clamps silly skip counts', () => {
    expect(skipPlan(0)).toHaveLength(2);
    expect(skipPlan(40)).toHaveLength(6);
  });

  it('says "1 skip!" and "4 skips!"', () => {
    expect(skipText(1)).toBe('1 skip!');
    expect(skipText(4)).toBe('4 skips!');
  });
});

describe('the best-skips record', () => {
  it('a first throw sets the record and Pajkel speaks (not for a lone skip)', () => {
    const r = noteSkips(newPlayer(), 3, DAY1);
    expect(r).toMatchObject({ record: true, speak: true });
    expect(r.player).toMatchObject({ skipsBest: 3, skipsLineDay: DAY1 });
    const lone = noteSkips(newPlayer(), 1, DAY1);
    expect(lone).toMatchObject({ record: true, speak: false });
    expect(lone.player.skipsBest).toBe(1);
    expect(lone.player.skipsLineDay).toBeUndefined();
  });

  it('only a better throw counts; equal or worse changes nothing', () => {
    const p = noteSkips(newPlayer(), 4, DAY1).player;
    const same = noteSkips(p, 4, DAY2);
    expect(same.record).toBe(false);
    expect(same.player).toBe(p);
    expect(noteSkips(p, 2, DAY2).player).toBe(p);
  });

  it('he speaks only the first time a record is beaten on a real day', () => {
    const a = noteSkips(newPlayer(), 2, DAY1);
    expect(a.speak).toBe(true);
    const b = noteSkips(a.player, 3, DAY1);
    expect(b).toMatchObject({ record: true, speak: false });
    expect(b.player.skipsBest).toBe(3);
    const c = noteSkips(b.player, 4, DAY2);
    expect(c).toMatchObject({ record: true, speak: true });
    expect(c.player.skipsLineDay).toBe(DAY2);
  });

  it('reads a saved best safely', () => {
    expect(skipsBestOf(newPlayer())).toBe(0);
    expect(skipsBestOf({ ...newPlayer(), skipsBest: 99 })).toBe(5);
    expect(skipsBestOf({ ...newPlayer(), skipsBest: Number.NaN })).toBe(0);
  });
});

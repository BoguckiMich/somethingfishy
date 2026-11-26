import { describe, expect, it } from 'vitest';
import { BEDTIME_LINES } from '../../core/data/pajkelLines';
import { seededRng } from '../../core/random';
import {
  DOG_BED_SPOT,
  FIRE_SPOT,
  coversFire,
  NAP_TUNING,
  PLAY_AREA,
  createCompanions,
  companionEvent,
  dogView,
  inDockBed,
  isCurled,
  isNapping,
  napBreath,
  napDue,
  petDog,
  startBedtime,
  startNapNow,
  startPlayNow,
  tickCompanions,
  type CompanionContext,
  type Companions,
} from './behaviour';

const nightBed: CompanionContext = { fishing: 'idle', night: true, bed: true };
const dayNoBed: CompanionContext = { fishing: 'idle', night: false };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Ticks until `until` is true (or `maxMs` pass); returns the ms it took, or -1. */
function runUntil(s: Companions, ctx: CompanionContext, rng: () => number, until: () => boolean, maxMs = 240_000): number {
  for (let t = 0; t < maxMs; t += 50) {
    if (until()) return t;
    tickCompanions(s, 50, ctx, rng);
  }
  return until() ? maxMs : -1;
}

/** A play session at its happy spin (the last thing before the nap decision). */
function atSpin(ctx: CompanionContext, seed = 4): { s: Companions; rng: () => number } {
  const rng = seededRng(seed);
  const s = createCompanions(rng);
  startPlayNow(s);
  expect(runUntil(s, ctx, rng, () => s.play.phase === 'spin')).toBeGreaterThan(0);
  return { s, rng };
}

describe('when she naps (the rule)', () => {
  it('never without the bed, always at night with it, and by chance by day', () => {
    expect(napDue({ night: true }, () => 0)).toBe(false);
    expect(napDue({ night: false }, () => 0)).toBe(false);
    expect(napDue({ night: true, bed: true }, () => 0.99)).toBe(true);
    expect(napDue({ night: false, bed: true }, () => NAP_TUNING.chanceDay - 0.01)).toBe(true);
    expect(napDue({ night: false, bed: true }, () => NAP_TUNING.chanceDay + 0.01)).toBe(false);
  });

  it('a play session without the bed goes straight to the rest, as before', () => {
    const { s, rng } = atSpin(dayNoBed);
    runUntil(s, dayNoBed, rng, () => s.play.phase !== 'spin');
    expect(s.play.phase).toBe('rest');
    expect(isNapping(s)).toBe(false);
  });
});

const dayBed: CompanionContext = { fishing: 'idle', night: false, bed: true };
/** An rng that always rolls low: `napDue` says yes by day. */
const napRoll = () => 0.1;

/** A play session whose spin ends in a nap by day: ticks until they are back on the dock (and she is settling). */
function sessionEndsInNap(): { s: Companions; rng: () => number } {
  const { s } = atSpin(dayBed);
  const rng = napRoll;
  expect(runUntil(s, dayBed, rng, () => s.mode === 'returning')).toBeGreaterThan(0);
  return { s, rng };
}

describe('Bestia naps in her bed on the dock (slices 27 and 31)', () => {
  it('after the spin the session ends: they walk back (no trip to the grass bed) and she settles in the dock bed', () => {
    const { s, rng } = sessionEndsInNap();
    expect(s.napWant).toBe(true);
    expect(runUntil(s, dayBed, rng, () => s.mode === 'dock', 60_000)).toBeGreaterThan(0);
    expect(s.napWant).toBe(false);
    expect(s.nap?.phase).toBe('circle');
    expect(isNapping(s)).toBe(true);
    expect(dist(s.dog, DOG_BED_SPOT)).toBeLessThan(1.5);
  });

  it('circles once on the spot (both ways seen), then lies curled for a good while, breathing, facing right', () => {
    const { s, rng } = sessionEndsInNap();
    runUntil(s, dayBed, rng, () => s.mode === 'dock', 60_000);
    const faces = new Set<number>();
    runUntil(s, dayBed, rng, () => {
      faces.add(s.dog.face);
      return s.nap?.phase === 'curl';
    });
    expect(faces.size).toBe(2);
    expect(isCurled(s)).toBe(true);
    expect(s.dog.shape).toBe('curl');
    expect(dist(s.dog, DOG_BED_SPOT)).toBeLessThan(1);
    expect(s.dog.face).toBe(1);
    expect(inDockBed(s)).toBe(true);
    expect(s.nap!.napMs).toBeGreaterThanOrEqual(NAP_TUNING.curlMs[0]);
    expect(s.nap!.napMs).toBeLessThanOrEqual(NAP_TUNING.curlMs[1]);
  });

  it('stays curled for the whole nap, then wakes by herself and lies in the bed', () => {
    const { s, rng } = sessionEndsInNap();
    runUntil(s, dayBed, rng, () => s.nap?.phase === 'curl', 120_000);
    const napMs = s.nap!.napMs;
    runUntil(s, dayBed, rng, () => s.nap!.phaseMs >= napMs - 200);
    expect(s.dog.shape).toBe('curl');
    runUntil(s, dayBed, rng, () => s.nap?.phase === 'wake');
    expect(isCurled(s)).toBe(false);
    runUntil(s, dayBed, rng, () => s.nap === null);
    expect(s.dog.shape).toBe('lie');
    expect(inDockBed(s)).toBe(true);
  });

  it('at night the session ends too, and she sleeps curled in the bed (the z comes from the curled frame), no wake-up', () => {
    const { s, rng } = atSpin(nightBed);
    runUntil(s, nightBed, rng, () => s.mode === 'dock', 120_000);
    runUntil(s, nightBed, rng, () => s.dog.sleeping, 30_000);
    expect(s.dog.shape).toBe('curl');
    expect(s.nap).toBeNull();
    for (let t = 0; t < 60_000; t += 50) tickCompanions(s, 50, nightBed, rng);
    expect(s.dog.shape).toBe('curl');
    expect(dist(s.dog, DOG_BED_SPOT)).toBeLessThan(1);
  });

  it('without the bed she sleeps stretched out at night, as before', () => {
    const rng = seededRng(3);
    const s = createCompanions(rng);
    for (let t = 0; t < 5_000; t += 50) tickCompanions(s, 50, { fishing: 'idle', night: true }, rng);
    expect(s.dog.shape).toBe('sleep');
    expect(inDockBed(s)).toBe(false);
  });

  it('with the bed she lies in it by day on the dock (the bed spot is her lying spot)', () => {
    const rng = seededRng(3);
    const s = createCompanions(rng);
    for (let t = 0; t < 5_000; t += 50) tickCompanions(s, 50, dayBed, rng);
    expect(s.dog.shape).toBe('lie');
    expect(inDockBed(s)).toBe(true);
    expect(DOG_BED_SPOT).toEqual(s.spots.companions.dog);
  });

  it('breathes: the chest is up for one half of a breath and down for the other', () => {
    expect(napBreath(0)).toBe(0);
    expect(napBreath(NAP_TUNING.breathMs / 2 + 1)).toBe(1);
    expect(napBreath(NAP_TUNING.breathMs + 1)).toBe(0);
    const s = createCompanions();
    s.elapsed = NAP_TUNING.breathMs / 2 + 10;
    expect(dogView(s).breath).toBe(1);
  });

  it('a pet wakes her at once: head up and wagging, then she lies in the bed again', () => {
    const rng = seededRng(2);
    const s = createCompanions(rng);
    startNapNow(s);
    expect(isCurled(s)).toBe(true);
    petDog(s);
    expect(s.nap?.phase).toBe('wake');
    expect(s.dog.shape).toBe('lie');
    expect(s.nap!.wakeMs).toBe(NAP_TUNING.wakePetMs);
    tickCompanions(s, 50, dayBed, rng);
    expect(s.dog.wagMs).toBeGreaterThan(0);
    runUntil(s, dayBed, rng, () => s.nap === null);
    expect(s.dog.shape).toBe('lie');
    expect(inDockBed(s)).toBe(true);
  });

  it('a bite wakes her too, and a cast sends them off: she leaves the bed', () => {
    const rng = seededRng(2);
    const s = createCompanions(rng);
    startNapNow(s);
    companionEvent(s, 'bite');
    expect(s.nap).toBeNull();
    expect(s.dog.reaction).toBe('stand');
    const s2 = createCompanions(rng);
    startNapNow(s2);
    s2.idleMs = 1e9;
    tickCompanions(s2, 50, dayBed, rng);
    expect(s2.mode).toBe('leaving');
    expect(s2.nap).toBeNull();
  });

  it('after the pebble outing she walks back and settles in the bed (just lies down, no nap)', () => {
    const rng = seededRng(2);
    const s = createCompanions(rng);
    s.mode = 'returning';
    s.paj.path = [];
    s.dog.path = [];
    tickCompanions(s, 50, dayBed, rng);
    expect(s.mode).toBe('dock');
    expect(s.nap?.napMs).toBe(0);
    runUntil(s, dayBed, rng, () => s.nap === null);
    expect(s.dog.shape).toBe('lie');
    expect(inDockBed(s)).toBe(true);
  });

  it('the 02:00 bedtime wakes her from the bed and the usual sequence begins', () => {
    const rng = seededRng(2);
    const s = createCompanions(rng);
    startNapNow(s);
    startBedtime(s, BEDTIME_LINES[0]);
    expect(s.mode).toBe('bed');
    expect(s.nap).toBeNull();
    expect(s.dog.shape).toBe('lie');
    tickCompanions(s, 50, nightBed, rng);
    expect(s.dog.shape).not.toBe('curl');
  });

  it('the bed is on the dock, nowhere near the grass lawn', () => {
    expect(DOG_BED_SPOT.y).toBeLessThan(PLAY_AREA.y0);
  });
});

describe('Pajkel keeps off the campfire (slice 27)', () => {
  it('knows where his head would cover the flames', () => {
    expect(coversFire({ x: FIRE_SPOT.x, y: FIRE_SPOT.y + 40 })).toBe(true);
    expect(coversFire({ x: FIRE_SPOT.x + 40, y: FIRE_SPOT.y + 40 })).toBe(false);
    expect(coversFire({ x: FIRE_SPOT.x, y: FIRE_SPOT.y - 30 })).toBe(false); // behind the fire is fine
    expect(coversFire({ x: FIRE_SPOT.x, y: FIRE_SPOT.y + 80 })).toBe(false);
  });

  it('walks out from in front of the fire when it is owned, and never lingers there while they play', () => {
    const rng = seededRng(6);
    const s = createCompanions(rng);
    startPlayNow(s); // he starts at (112, 540): right under the fire
    const ctx: CompanionContext = { fishing: 'idle', night: false, fire: true };
    const spots: { x: number; y: number }[] = [];
    for (let t = 0; t < 120_000; t += 50) {
      tickCompanions(s, 50, ctx, rng);
      if (t > 1000) spots.push({ x: s.paj.x, y: s.paj.y });
    }
    const inFront = spots.filter((p) => coversFire(p)).length;
    expect(inFront / spots.length).toBeLessThan(0.05);
    // And without the fire he is left alone.
    const s2 = createCompanions(rng);
    startPlayNow(s2);
    tickCompanions(s2, 50, { fishing: 'idle', night: false }, rng);
    expect(s2.paj.x).toBe(112);
  });
});

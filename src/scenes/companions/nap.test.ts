import { describe, expect, it } from 'vitest';
import { BEDTIME_LINES } from '../../core/data/pajkelLines';
import { seededRng } from '../../core/random';
import {
  DOG_BED_SPOT,
  FIRE_SPOT,
  coversFire,
  NAP_TUNING,
  PLAY_AREA,
  companionPress,
  createCompanions,
  dogView,
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

describe('Bestia naps in her bed (slice 27)', () => {
  it('after the spin at night she trots to the bed, circles once, lies curled for a good while, then gets up and the play goes on', () => {
    const { s, rng } = atSpin(nightBed);
    const seen: string[] = [];
    for (let t = 0; t < 240_000 && s.play.phase !== 'rest' && !(seen.includes('napWake') && s.play.phase === 'toStick'); t += 50) {
      tickCompanions(s, 50, nightBed, rng);
      if (seen[seen.length - 1] !== s.play.phase) seen.push(s.play.phase);
    }
    expect(seen.slice(seen.indexOf('spin'))).toEqual(['spin', 'napGo', 'napCircle', 'napCurl', 'napWake', 'rest']);
  });

  it('trots onto the bed spot, circles on it, and lies there curled, breathing, facing right', () => {
    const { s, rng } = atSpin(nightBed);
    expect(runUntil(s, nightBed, rng, () => s.play.phase === 'napCircle')).toBeGreaterThan(0);
    expect(dist(s.dog, DOG_BED_SPOT)).toBeLessThan(1.5);
    // The circle: she turns on the spot (both ways seen).
    const faces = new Set<number>();
    runUntil(s, nightBed, rng, () => {
      faces.add(s.dog.face);
      return s.play.phase === 'napCurl';
    });
    expect(faces.size).toBe(2);
    expect(isCurled(s)).toBe(true);
    expect(s.dog.shape).toBe('curl');
    expect(s.dog.x).toBeCloseTo(DOG_BED_SPOT.x, 0);
    expect(s.dog.y).toBeCloseTo(DOG_BED_SPOT.y, 0);
    expect(s.dog.face).toBe(1);
    expect(s.play.napMs).toBeGreaterThanOrEqual(NAP_TUNING.curlMs[0]);
    expect(s.play.napMs).toBeLessThanOrEqual(NAP_TUNING.curlMs[1]);
  });

  it('stays curled for the whole nap (and Pajkel waits), then wakes by herself', () => {
    const { s, rng } = atSpin(nightBed);
    runUntil(s, nightBed, rng, () => s.play.phase === 'napCurl');
    const napMs = s.play.napMs;
    runUntil(s, nightBed, rng, () => s.play.phaseMs >= napMs - 200);
    expect(s.dog.shape).toBe('curl');
    expect(s.paj.shape).toBe('stand');
    runUntil(s, nightBed, rng, () => s.play.phase === 'napWake');
    expect(isCurled(s)).toBe(false);
    expect(isNapping(s)).toBe(true);
  });

  it('breathes: the chest is up for one half of a breath and down for the other', () => {
    expect(napBreath(0)).toBe(0);
    expect(napBreath(NAP_TUNING.breathMs / 2 + 1)).toBe(1);
    expect(napBreath(NAP_TUNING.breathMs + 1)).toBe(0);
    const s = createCompanions();
    s.elapsed = NAP_TUNING.breathMs / 2 + 10;
    expect(dogView(s).breath).toBe(1);
  });

  it('a pet wakes her at once: head up and wagging, then she gets up', () => {
    const rng = seededRng(2);
    const s = createCompanions(rng);
    startNapNow(s);
    expect(isCurled(s)).toBe(true);
    petDog(s);
    expect(s.play.phase).toBe('napWake');
    expect(s.dog.shape).toBe('lie');
    expect(s.play.wakeMs).toBe(NAP_TUNING.wakePetMs);
    tickCompanions(s, 50, nightBed, rng);
    expect(dogView(s).tail).toBeGreaterThanOrEqual(0);
    expect(s.dog.wagMs).toBeGreaterThan(0);
    runUntil(s, nightBed, rng, () => s.play.phase !== 'napWake');
    expect(s.play.phase).toBe('rest');
    expect(s.dog.shape).not.toBe('curl');
  });

  it('a press (a cast) while she sleeps sends everyone back to the dock; she leaves the bed', () => {
    const rng = seededRng(2);
    const s = createCompanions(rng);
    startNapNow(s);
    companionPress(s);
    expect(s.mode).toBe('returning');
    runUntil(s, nightBed, rng, () => s.mode === 'dock', 60_000);
    expect(s.mode).toBe('dock');
    expect(s.dog.shape).not.toBe('curl');
  });

  it('the 02:00 bedtime wakes her from the bed and the usual sequence begins', () => {
    const rng = seededRng(2);
    const s = createCompanions(rng);
    startNapNow(s);
    startBedtime(s, BEDTIME_LINES[0]);
    expect(s.mode).toBe('bed');
    expect(s.dog.shape).toBe('sit');
    tickCompanions(s, 50, nightBed, rng);
    expect(s.dog.shape).not.toBe('curl');
  });

  it('never leaves the grass: the bed spot is under the lawn, clear of the play area', () => {
    expect(DOG_BED_SPOT.y).toBeGreaterThan(PLAY_AREA.y1);
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

import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../art/raster';
import { BEDTIME_LINES } from '../../core/data/pajkelLines';
import {
  BED_TUNING,
  CAR_DOG,
  CAR_STAND,
  PAJ_SPOT,
  carVariant,
  companionEvent,
  companionPress,
  createCompanions,
  dogView,
  dogVisible,
  isInCar,
  pajStretchHigh,
  pajVisible,
  startBedtime,
  startInCar,
  startNap,
  startPlayNow,
  tickCompanions,
  wakeUp,
  type CompanionContext,
  type Companions,
} from './behaviour';

const rng = () => 0.5;
const idle: CompanionContext = { fishing: 'idle', night: false };
const night: CompanionContext = { fishing: 'idle', night: true };

function run(s: Companions, ms: number, ctx: CompanionContext = idle): void {
  for (let t = 0; t < ms; t += 50) tickCompanions(s, 50, ctx, rng);
}

const settled = () => {
  const s = createCompanions(rng);
  run(s, 500, night);
  return s;
};

/** Runs until `done` or the cap; returns the phases seen, in order ('dock' once the sequence is over). */
function phases(s: Companions, done: () => boolean, capMs = 60_000, seed = 3): string[] {
  const r = mulberry32(seed);
  const seen: string[] = [];
  for (let t = 0; t < capMs && !done(); t += 50) {
    tickCompanions(s, 50, night, r);
    const ph = s.bed?.phase ?? 'dock';
    if (seen[seen.length - 1] !== ph) seen.push(ph);
  }
  return seen;
}

describe('bedtime at 02:00 (slice 16)', () => {
  it('Pajkel says his line first, then calls Bestia', () => {
    const s = settled();
    startBedtime(s, BEDTIME_LINES[2]);
    expect(s.mode).toBe('bed');
    expect(s.bubble?.text).toBe('I need to change my socks');
    expect(s.bed?.phase).toBe('say');
    run(s, BED_TUNING.sayMs + 50, night);
    expect(s.bed?.phase).toBe('call');
    expect(s.paj.shape).toBe('stand');
    expect(dogView(s).perked).toBe(true);
  });

  it('has three lines, one of them the socks joke', () => {
    expect(BEDTIME_LINES).toHaveLength(3);
    expect(BEDTIME_LINES).toContain('I need to change my socks');
  });

  it('goes say, call, chase, catch, carry, door, enter, shut, light, asleep', () => {
    const s = settled();
    startBedtime(s, BEDTIME_LINES[0]);
    const seen = phases(s, () => isInCar(s));
    expect(seen).toEqual(['say', 'call', 'chase', 'catch', 'carry', 'doorOpen', 'enter', 'doorShut', 'light', 'asleep']);
    expect(pajVisible(s)).toBe(false);
    expect(dogVisible(s)).toBe(false);
  });

  it('Bestia zigzags across the grass; Pajkel chases but stays behind her until she stops', () => {
    const s = settled();
    startBedtime(s, BEDTIME_LINES[0]);
    run(s, BED_TUNING.sayMs + BED_TUNING.callMs + 100, night);
    expect(s.bed?.phase).toBe('chase');
    const xs: number[] = [];
    let behind = 0;
    let frames = 0;
    const r = mulberry32(5);
    while (s.bed?.phase === 'chase') {
      tickCompanions(s, 50, night, r);
      if (s.dog.path.length > 0) {
        frames++;
        if (Math.hypot(s.paj.x - s.dog.x, s.paj.y - s.dog.y) > 12) behind++;
        xs.push(s.dog.x);
      }
    }
    let turns = 0;
    for (let i = 2; i < xs.length; i++) if (Math.sign(xs[i] - xs[i - 1]) * Math.sign(xs[i - 1] - xs[i - 2]) < 0) turns++;
    expect(turns).toBeGreaterThanOrEqual(2);
    expect(behind / frames).toBeGreaterThan(0.7);
    expect(s.bed?.phase).toBe('catch');
  });

  it('the chase always ends: Pajkel gives up after the cap even if she keeps running', () => {
    const s = settled();
    startBedtime(s, BEDTIME_LINES[0]);
    run(s, BED_TUNING.sayMs + BED_TUNING.callMs + 100, night);
    const lap = [{ x: 320, y: 584 }, { x: 90, y: 508 }];
    s.dog.path = Array.from({ length: 40 }, (_, i) => ({ ...lap[i % 2] }));
    for (let t = 0; t < BED_TUNING.chaseGiveUpMs + 500 && s.bed?.phase === 'chase'; t += 50) tickCompanions(s, 50, night, rng);
    expect(s.bed?.phase).not.toBe('chase');
  });

  it('carries her: she is in his arms (not drawn on her own) and he walks left to the car door', () => {
    const s = settled();
    startBedtime(s, BEDTIME_LINES[0]);
    phases(s, () => s.bed?.phase === 'carry');
    expect(s.bed?.carried).toBe(true);
    expect(s.paj.shape).toBe('carry');
    expect(dogVisible(s)).toBe(false);
    const x0 = s.paj.x;
    run(s, 400, night);
    expect(s.paj.x).toBeLessThan(x0);
    phases(s, () => s.bed?.phase === 'doorOpen');
    expect(Math.hypot(s.paj.x - CAR_STAND.x, s.paj.y - CAR_STAND.y)).toBeLessThan(1);
    expect(carVariant(s)).toBe('open');
  });

  it('the door shuts behind them, the interior light is on for a few seconds, then off', () => {
    const s = settled();
    startBedtime(s, BEDTIME_LINES[0]);
    phases(s, () => s.bed?.phase === 'doorShut');
    expect(carVariant(s)).toBe('closed');
    expect(s.bed?.pajA).toBe(0);
    phases(s, () => s.bed?.phase === 'light');
    expect(carVariant(s)).toBe('light');
    run(s, BED_TUNING.lightMs.night - 200, night);
    expect(carVariant(s)).toBe('light');
    run(s, 400, night);
    expect(carVariant(s)).toBe('closed');
    expect(isInCar(s)).toBe(true);
  });

  it('starts straight from the grass too', () => {
    const s = createCompanions(rng);
    startPlayNow(s);
    run(s, 800, night);
    startBedtime(s, BEDTIME_LINES[1]);
    expect(s.paj.shape).toBe('stand');
    const seen = phases(s, () => isInCar(s));
    expect(seen[seen.length - 1]).toBe('asleep');
  });

  it('a bite or a press while it runs does not break it', () => {
    const s = settled();
    startBedtime(s, BEDTIME_LINES[0]);
    companionEvent(s, 'bite');
    companionPress(s);
    expect(s.mode).toBe('bed');
    expect(s.bed?.phase).toBe('say');
  });

  it('they sleep until woken; then the door opens, they step out, walk home, and Pajkel stretches once', () => {
    const s = settled();
    startBedtime(s, BEDTIME_LINES[0]);
    phases(s, () => isInCar(s));
    run(s, 20_000, night);
    expect(isInCar(s)).toBe(true);
    wakeUp(s);
    expect(s.bed?.phase).toBe('exitOpen');
    expect(carVariant(s)).toBe('open');
    const seen = phases(s, () => s.mode === 'dock');
    expect(seen).toEqual(['exitOpen', 'exitShut', 'return', 'stretch', 'dock']);
    expect(Math.hypot(s.paj.x - PAJ_SPOT.x, s.paj.y - PAJ_SPOT.y)).toBeLessThan(1);
    expect(s.paj.shape).toBe('sit');
    expect(pajVisible(s) && dogVisible(s)).toBe(true);
    expect(s.bed).toBeNull();
  });

  it('on the way home Bestia trots on her own; the stretch has an arms-up beat', () => {
    const s = settled();
    startInCar(s);
    wakeUp(s);
    phases(s, () => s.bed?.phase === 'return');
    expect(s.bed?.carried).toBe(false);
    expect(s.dog.shape).toBe('run');
    expect(dogVisible(s)).toBe(true);
    phases(s, () => s.bed?.phase === 'stretch');
    expect(s.paj.shape).toBe('stretch');
    expect(pajStretchHigh(s)).toBe(false);
    run(s, BED_TUNING.stretchUpFromMs + 100, night);
    expect(pajStretchHigh(s)).toBe(true);
  });

  it('waking does nothing unless they are asleep', () => {
    const s = settled();
    wakeUp(s);
    expect(s.mode).toBe('dock');
    startBedtime(s, BEDTIME_LINES[0]);
    wakeUp(s);
    expect(s.bed?.phase).toBe('say');
  });

  it('startInCar: hidden in the car, door shut, and they stay there', () => {
    const s = createCompanions(rng);
    startInCar(s);
    expect(isInCar(s)).toBe(true);
    expect(carVariant(s)).toBe('closed');
    expect(pajVisible(s) || dogVisible(s)).toBe(false);
    run(s, 5000, night);
    expect(isInCar(s)).toBe(true);
  });
});

describe('a nap (slice 16)', () => {
  it('both walk to the car with no chase, get in, and fall asleep', () => {
    const s = createCompanions(rng);
    run(s, 500);
    expect(startNap(s)).toBe(true);
    const seen: string[] = [];
    for (let t = 0; t < 40_000 && !isInCar(s); t += 50) {
      tickCompanions(s, 50, idle, rng);
      const ph = s.bed?.phase ?? '';
      if (seen[seen.length - 1] !== ph) seen.push(ph);
    }
    expect(seen).toEqual(['walk', 'doorOpen', 'enter', 'doorShut', 'light', 'asleep']);
    expect(s.bubble).toBeNull();
  });

  it('walks to the car door and waits beside it, Bestia not carried', () => {
    const s = createCompanions(rng);
    run(s, 500);
    startNap(s);
    while (s.bed?.phase === 'walk') tickCompanions(s, 50, idle, rng);
    expect(s.bed?.carried).toBe(false);
    expect(Math.hypot(s.paj.x - CAR_STAND.x, s.paj.y - CAR_STAND.y)).toBeLessThan(1);
    expect(Math.hypot(s.dog.x - CAR_DOG.x, s.dog.y - CAR_DOG.y)).toBeLessThan(1);
    expect(dogVisible(s)).toBe(true);
  });

  it('only starts from the dock', () => {
    const s = createCompanions(rng);
    startPlayNow(s);
    expect(startNap(s)).toBe(false);
    expect(s.mode).toBe('play');
  });
});

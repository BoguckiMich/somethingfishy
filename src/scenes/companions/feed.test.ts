import { describe, expect, it } from 'vitest';
import { QUIET_LAKE, RIVER_BEND } from '../../core/data/locations';
import { seededRng } from '../../core/random';
import {
  DOG_BED_SPOT,
  FEED_ANIM,
  bowlHasFood,
  bowlStand,
  companionPress,
  createCompanions,
  dogView,
  feedBusy,
  feedRequest,
  isCurled,
  startBedtime,
  startInCar,
  startNapNow,
  startPlayNow,
  tickCompanions,
  type CompanionContext,
  type Companions,
} from './behaviour';
import { pebbleRequest } from './behaviour';

const day: CompanionContext = { fishing: 'idle', night: false, bed: true };
const night: CompanionContext = { fishing: 'idle', night: true, bed: true };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function fresh(seed = 4): { s: Companions; rng: () => number } {
  const rng = seededRng(seed);
  return { s: createCompanions(rng), rng };
}

/** Ticks until `until` holds (or `maxMs` pass); returns the ms it took, or -1. */
function runUntil(s: Companions, rng: () => number, until: () => boolean, ctx: CompanionContext = day, maxMs = 120_000): number {
  for (let t = 0; t < maxMs; t += 50) {
    if (until()) return t;
    tickCompanions(s, 50, ctx, rng);
  }
  return until() ? maxMs : -1;
}
const run = (s: Companions, rng: () => number, ms: number, ctx: CompanionContext = day) => void runUntil(s, rng, () => false, ctx, ms);

describe('the bowl spot', () => {
  it('is a place of its own on the grass by the car, clear of the car, the bed and the bottom bar', () => {
    const b = QUIET_LAKE.spots.bowl;
    const car = QUIET_LAKE.spots.carHit;
    expect(b.y).toBeGreaterThan(car.y + car.h); // below the car's tap box
    expect(b.x).toBeLessThan(QUIET_LAKE.spots.camp.bed.x - 24); // left of her bed
    expect(bowlStand(QUIET_LAKE.spots).y).toBeLessThan(600); // above the bottom bar
  });

  it('the River bend has the same grass by the car, so the bowl is there too', () => {
    expect(RIVER_BEND.spots.bowl).toEqual(QUIET_LAKE.spots.bowl);
  });
});

describe('feeding from the chair on the dock', () => {
  it('she trots to the bowl, eats about two seconds, wags, and trots back; the count rises when she has eaten', () => {
    const { s, rng } = fresh();
    expect(feedRequest(s, day)).toBe('started');
    expect(feedBusy(s)).toBe(true);
    expect(bowlHasFood(s)).toBe(true);
    expect(runUntil(s, rng, () => s.feed?.phase === 'eat')).toBeGreaterThan(0);
    expect(dist(s.dog, bowlStand(s.spots))).toBeLessThan(1);
    expect(s.dog.face).toBe(-1); // the bowl is on her left
    expect(s.dog.shape).toBe('eat');
    expect(s.fedCount).toBe(0);
    const eatMs = runUntil(s, rng, () => s.feed?.phase === 'wag');
    expect(eatMs).toBeGreaterThanOrEqual(FEED_ANIM.eatMs - 50);
    expect(eatMs).toBeLessThanOrEqual(FEED_ANIM.eatMs + 100);
    expect(s.fedCount).toBe(1);
    expect(bowlHasFood(s)).toBe(false); // eaten
    tickCompanions(s, 50, day, rng);
    expect(dogView(s).shape).toBe('stand');
    run(s, rng, FEED_ANIM.wagMs + 50);
    expect(s.feed?.phase).toBe('back');
    expect(runUntil(s, rng, () => s.feed === null)).toBeGreaterThan(0);
    expect(s.mode).toBe('dock');
    expect(dist(s.dog, s.spots.companions.dog)).toBeLessThan(4);
    expect(feedBusy(s)).toBe(false);
  });

  it('the munch is two frames that alternate while she eats', () => {
    const { s, rng } = fresh();
    feedRequest(s, day);
    runUntil(s, rng, () => s.feed?.phase === 'eat');
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      tickCompanions(s, 50, day, rng);
      if (s.feed?.phase === 'eat') seen.add(dogView(s).munch);
    }
    expect([...seen].sort()).toEqual([0, 1]);
  });

  it('she walks down the planks and across the grass, never through the water', () => {
    const { s, rng } = fresh();
    feedRequest(s, day);
    let maxWater = 0;
    for (let t = 0; t < 8000 && s.feed?.phase !== 'eat'; t += 50) {
      tickCompanions(s, 50, day, rng);
      if (s.dog.y < s.spots.companions.grassY) maxWater = Math.max(maxWater, Math.abs(s.dog.x - s.spots.companions.dog.x));
    }
    expect(maxWater).toBeLessThan(40); // on the planks she stays on the dock's line
  });

  it('a second tap while the treat is in the bowl changes nothing; Pajkel keeps his chair and does not leave for the lawn', () => {
    const { s, rng } = fresh();
    feedRequest(s, day);
    expect(feedRequest(s, day)).toBe('queued');
    run(s, rng, 9000); // the whole meal, but not yet the idle walk to the lawn
    expect(s.fedCount).toBe(1);
    expect(s.mode).toBe('dock');
  });

  it('the idle walk to the lawn waits while a treat is waiting', () => {
    const { s, rng } = fresh();
    s.idleMs = 24_990;
    feedRequest(s, day);
    run(s, rng, 200);
    expect(s.mode).toBe('dock');
  });
});

describe('feeding on the lawn', () => {
  it('between rounds she goes at once and then goes back to him', () => {
    const { s, rng } = fresh();
    startPlayNow(s);
    expect(runUntil(s, rng, () => s.play.phase === 'rest' || s.play.phase === 'spin')).toBeGreaterThan(0);
    expect(feedRequest(s, day)).toBe('started');
    expect(runUntil(s, rng, () => s.feed === null)).toBeGreaterThan(0);
    expect(s.fedCount).toBe(1);
    expect(s.mode).toBe('play');
    expect(dist(s.dog, s.paj)).toBeLessThan(60);
  });

  it('in the middle of a fetch round the treat waits: the round ends, then she goes (the game ends there)', () => {
    const { s, rng } = fresh();
    startPlayNow(s);
    expect(runUntil(s, rng, () => s.play.phase === 'keepAway' || s.play.phase === 'bring')).toBeGreaterThan(0);
    expect(feedRequest(s, day)).toBe('queued');
    expect(s.feed).toBeNull();
    expect(bowlHasFood(s)).toBe(true);
    const rounds = s.roundsDone;
    expect(runUntil(s, rng, () => s.feed !== null)).toBeGreaterThan(0);
    expect(s.roundsDone).toBe(rounds + 1); // the round was played to its end first
    expect(s.stick.state).not.toBe('carried');
    expect(runUntil(s, rng, () => s.feed === null)).toBeGreaterThan(0);
    expect(s.fedCount).toBe(1);
  });

  it('while she eats he waits where he stands; nothing is thrown', () => {
    const { s, rng } = fresh();
    startPlayNow(s);
    runUntil(s, rng, () => s.play.phase === 'rest' || s.play.phase === 'spin');
    feedRequest(s, day);
    const at = { x: s.paj.x, y: s.paj.y };
    run(s, rng, 3000);
    expect(dist(s.paj, at)).toBeLessThan(1);
    expect(s.stick.state).not.toBe('flying');
  });

  it('a cast mid-meal lets her finish, then the family goes back to the dock', () => {
    const { s, rng } = fresh();
    startPlayNow(s);
    runUntil(s, rng, () => s.play.phase === 'rest' || s.play.phase === 'spin');
    feedRequest(s, day);
    run(s, rng, 1000);
    companionPress(s, 'idle');
    expect(s.feed).not.toBeNull();
    expect(s.mode).toBe('play'); // not yet
    expect(runUntil(s, rng, () => s.feed === null)).toBeGreaterThan(0);
    expect(s.fedCount).toBe(1);
    expect(runUntil(s, rng, () => s.mode === 'dock')).toBeGreaterThan(0);
  });
});

describe('feeding while she naps in her bed', () => {
  it('she gets up, eats, goes back to her bed and curls up again', () => {
    const { s, rng } = fresh();
    startNapNow(s);
    expect(isCurled(s)).toBe(true);
    expect(feedRequest(s, day)).toBe('started');
    expect(s.dog.shape).toBe('run');
    expect(runUntil(s, rng, () => s.feed === null)).toBeGreaterThan(0);
    expect(s.fedCount).toBe(1);
    expect(s.mode).toBe('dock');
    expect(s.nap?.phase).toBe('circle');
    expect(runUntil(s, rng, () => isCurled(s))).toBeGreaterThan(0);
    expect(dist(s.dog, DOG_BED_SPOT)).toBeLessThan(2);
  });

  it('at night she sleeps and is not woken for it', () => {
    const { s } = fresh();
    startNapNow(s);
    expect(feedRequest(s, night)).toBe('no');
    expect(feedBusy(s)).toBe(false);
    expect(isCurled(s)).toBe(true);
  });
});

describe('feeding at the stones', () => {
  it('between throws she trots to the bowl and comes back to sit by him', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, { skips: 3, side: 0, big: false }, 'idle');
    expect(runUntil(s, rng, () => s.mode === 'shore' && s.shore.phase === 'idle' && s.dog.path.length === 0)).toBeGreaterThan(0);
    expect(feedRequest(s, day)).toBe('started');
    expect(runUntil(s, rng, () => s.feed === null)).toBeGreaterThan(0);
    expect(s.fedCount).toBe(1);
    expect(s.mode).toBe('shore');
    expect(dist(s.dog, s.spots.companions.shore!.dogSit)).toBeLessThan(4);
  });

  it('a pebble tapped mid-meal is not thrown (nothing starts until she is back)', () => {
    const { s, rng } = fresh();
    feedRequest(s, day);
    run(s, rng, 500);
    expect(pebbleRequest(s, { skips: 3, side: 0, big: false }, 'idle')).toBe('no');
    expect(s.mode).toBe('dock');
  });
});

describe('when she cannot be fed', () => {
  it('not from the car or inside bedtime', () => {
    const a = fresh().s;
    startInCar(a);
    expect(feedRequest(a, night)).toBe('no');
    const b = fresh().s;
    startBedtime(b, 'Bedtime!');
    expect(feedRequest(b, night)).toBe('no');
    expect(feedBusy(a) || feedBusy(b)).toBe(false);
  });

  it('not while she sleeps on the dock at night', () => {
    const { s, rng } = fresh();
    run(s, rng, 3000, night);
    expect(s.dog.sleeping).toBe(true);
    expect(feedRequest(s, night)).toBe('no');
  });

  it('bedtime starting clears a treat that is still waiting', () => {
    const { s } = fresh();
    startPlayNow(s);
    s.play.phase = 'keepAway';
    expect(feedRequest(s, day)).toBe('queued');
    startBedtime(s, 'Bedtime!');
    expect(s.feedWant).toBe(false);
    expect(s.feed).toBeNull();
  });

  it('a treat waiting while he walks to the stones is eaten once things are calm', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, { skips: 3, side: 0, big: false }, 'idle');
    expect(s.mode).toBe('shore');
    expect(feedRequest(s, day)).toBe('queued'); // the dog is still on her way to sit by him
    expect(runUntil(s, rng, () => s.fedCount === 1)).toBeGreaterThan(0);
  });
});

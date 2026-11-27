import { describe, expect, it } from 'vitest';
import { QUIET_LAKE, RIVER_BEND } from '../../core/data/locations';
import { seededRng } from '../../core/random';
import {
  BRING_ANIM,
  bowlHasFood,
  bringRequest,
  companionPress,
  createCompanions,
  dogView,
  feedBusy,
  feedRequest,
  startBedtime,
  startNapNow,
  startPlayNow,
  tickCompanions,
  type CompanionContext,
  type Companions,
} from './behaviour';

const day: CompanionContext = { fishing: 'idle', night: false, bed: true };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function fresh(seed = 4, spots = QUIET_LAKE.spots): { s: Companions; rng: () => number } {
  const rng = seededRng(seed);
  return { s: createCompanions(rng, spots), rng };
}

function runUntil(s: Companions, rng: () => number, until: () => boolean, ctx: CompanionContext = day, maxMs = 120_000): number {
  for (let t = 0; t < maxMs; t += 50) {
    if (until()) return t;
    tickCompanions(s, 50, ctx, rng);
  }
  return until() ? maxMs : -1;
}

describe('Bestia brings a lure back (slice 32)', () => {
  it('she trots to the water edge, dips for it, brings it in her mouth, drops it by Alex and goes back to her spot', () => {
    const { s, rng } = fresh();
    expect(bringRequest(s)).toBe('started');
    expect(feedBusy(s)).toBe(true);
    expect(dogView(s).lure).toBeNull(); // nothing yet
    expect(runUntil(s, rng, () => s.feed?.phase === 'eat')).toBeGreaterThan(0);
    expect(dist(s.dog, BRING_ANIM.edge)).toBeLessThan(1);
    expect(s.dog.shape).toBe('bow'); // the dip
    expect(dogView(s).lure).toBeNull();
    expect(runUntil(s, rng, () => s.feed?.phase === 'bring')).toBeGreaterThanOrEqual(BRING_ANIM.dipMs - 50);
    expect(dogView(s).lure).toBe('mouth');
    expect(s.lureBrought).toBe(0); // not dropped yet
    expect(runUntil(s, rng, () => s.feed?.phase === 'wag')).toBeGreaterThan(0);
    expect(s.lureBrought).toBe(1);
    expect(dist(s.dog, BRING_ANIM.drop)).toBeLessThan(1);
    expect(dogView(s).lure).toBe('drop');
    expect(runUntil(s, rng, () => s.feed === null)).toBeGreaterThan(0);
    expect(s.mode).toBe('dock');
    expect(dogView(s).lure).toBeNull();
    expect(dist(s.dog, s.spots.companions.dog)).toBeLessThan(40); // home (settled in her bed on the next ticks)
  });

  it('the places on her way are on land: the corner and the edge are below the planks, the drop is on the dock', () => {
    for (const spots of [QUIET_LAKE.spots, RIVER_BEND.spots]) {
      expect(BRING_ANIM.corner.y).toBeGreaterThan(spots.companions.grassY);
      expect(BRING_ANIM.edge.x).toBeLessThan(spots.dock.x); // left of the planks
      expect(BRING_ANIM.drop.y).toBeLessThan(spots.companions.grassY); // on the planks
    }
  });

  it('the bowl does not show kibble for a lure, and a treat tapped meanwhile is eaten after she is back', () => {
    const { s, rng } = fresh();
    bringRequest(s);
    expect(bowlHasFood(s)).toBe(false);
    expect(feedRequest(s, day)).toBe('queued');
    expect(bowlHasFood(s)).toBe(true);
    expect(runUntil(s, rng, () => s.lureBrought === 1)).toBeGreaterThan(0);
    expect(runUntil(s, rng, () => s.fedCount === 1)).toBeGreaterThan(0); // the meal follows
  });

  it('she does not go while she is asleep in her bed, in the middle of a meal, or when the family is on the lawn', () => {
    const asleep = fresh().s;
    startNapNow(asleep);
    expect(bringRequest(asleep)).toBe('no');
    const eating = fresh().s;
    feedRequest(eating, day);
    expect(bringRequest(eating)).toBe('no');
    const lawn = fresh().s;
    startPlayNow(lawn);
    expect(bringRequest(lawn)).toBe('no');
    const sleeping = fresh().s;
    sleeping.dog.sleeping = true;
    expect(bringRequest(sleeping)).toBe('no');
  });

  it('bedtime ends the errand at once', () => {
    const { s, rng } = fresh();
    bringRequest(s);
    runUntil(s, rng, () => s.feed?.phase === 'eat');
    startBedtime(s, 'Time for bed');
    expect(s.feed).toBeNull();
    expect(s.mode).toBe('bed');
  });

  it('a cast on the way lets her finish first, then the press is replayed', () => {
    const { s, rng } = fresh();
    bringRequest(s);
    runUntil(s, rng, () => s.feed?.phase === 'eat');
    companionPress(s, 'idle');
    expect(s.feed).not.toBeNull();
    expect(runUntil(s, rng, () => s.feed === null)).toBeGreaterThan(0);
    expect(s.lureBrought).toBe(1);
  });
});

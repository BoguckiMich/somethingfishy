import { describe, expect, it } from 'vitest';
import { ONE_SEC_LINE, SKIP_FIVE_LINES } from '../../core/data/pajkelLines';
import { seededRng } from '../../core/random';
import {
  SHORE_TUNING,
  chairEmpty,
  companionEvent,
  companionPress,
  createCompanions,
  isSipShape,
  pebbleLanded,
  pebbleRequest,
  startBedtime,
  startInCar,
  startPlayNow,
  takePebbleRelease,
  tickCompanions,
  type CompanionContext,
  type Companions,
  type PebbleThrow,
  type ShorePhase,
} from './behaviour';
import { pebbleRoute } from '../pebbleRoute';

const TAP: PebbleThrow = { skips: 3, side: 0, big: false };
const BIG: PebbleThrow = { skips: 5, side: 0, big: true };
const ctxOf = (fishing: string): CompanionContext => ({ fishing, night: false });

function fresh(seed = 4): { s: Companions; rng: () => number } {
  const rng = seededRng(seed);
  return { s: createCompanions(rng), rng };
}

/** Ticks for `ms`, stopping early when `until` holds; returns the ms it took, or -1 when it never did. */
function runUntil(s: Companions, rng: () => number, until: () => boolean, maxMs = 60_000, fishing = 'idle'): number {
  for (let t = 0; t < maxMs; t += 50) {
    if (until()) return t;
    tickCompanions(s, 50, ctxOf(fishing), rng);
  }
  return until() ? maxMs : -1;
}
const run = (s: Companions, rng: () => number, ms: number, fishing = 'idle') => void runUntil(s, rng, () => false, ms, fishing);

/** Walks to the stones, throws, takes the pebble out of his hand (as the scene does); stops at the moment the pebble is in the air. */
function throwUntilRelease(s: Companions, rng: () => number, fishing = 'idle') {
  expect(runUntil(s, rng, () => s.release !== null, 60_000, fishing)).toBeGreaterThanOrEqual(0);
  return takePebbleRelease(s)!;
}

describe('the pebble outing', () => {
  it('a tap on the stones gets him out of his chair, to the stones, bending for a pebble, winding up and flicking it sideways', () => {
    const { s, rng } = fresh();
    expect(chairEmpty(s)).toBe(false);
    expect(pebbleRequest(s, TAP, 'idle')).toBe('started');
    expect(s.mode).toBe('shore');
    expect(chairEmpty(s)).toBe(true);
    const seen: ShorePhase[] = [];
    const shapes = new Set<string>();
    expect(
      runUntil(s, rng, () => {
        if (seen[seen.length - 1] !== s.shore.phase) seen.push(s.shore.phase);
        shapes.add(s.paj.shape);
        return s.release !== null;
      }),
    ).toBeGreaterThan(0);
    expect(seen).toEqual(['walk', 'pick', 'windUp', 'flick']);
    expect([...shapes]).toEqual(expect.arrayContaining(['walk', 'pick', 'windup', 'flick']));
    const rel = takePebbleRelease(s)!;
    expect(rel).toMatchObject({ skips: 3, side: 0, big: false });
    // He stands at the stones, facing the water on the left, and the pebble leaves his hand out in front of him.
    expect(s.paj.x).toBeCloseTo(SHORE_TUNING.stand.x, 0);
    expect(s.paj.face).toBe(-1);
    expect(rel.from.x).toBeLessThan(s.paj.x);
    expect(takePebbleRelease(s)).toBeNull(); // taken once
  });

  it('Bestia trots after him and sits beside him', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'idle');
    run(s, rng, 6000);
    expect(s.dog.x).toBeCloseTo(SHORE_TUNING.dogSit.x, 0);
    expect(s.dog.shape).toBe('sit');
  });

  it('after the throw he watches until it sinks, reacts, waits, and walks back to his chair after ~5 s with no tap', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'idle');
    throwUntilRelease(s, rng);
    expect(runUntil(s, rng, () => s.shore.phase === 'watch')).toBeGreaterThanOrEqual(0);
    run(s, rng, 1000); // still watching: the scene has not said where it sank
    expect(s.shore.phase).toBe('watch');
    pebbleLanded(s, 3, rng);
    expect(s.shore.phase).toBe('react');
    expect(runUntil(s, rng, () => s.shore.phase === 'idle')).toBeGreaterThan(0);
    const idleSince = s.elapsed;
    expect(runUntil(s, rng, () => s.mode === 'returning')).toBeGreaterThan(0);
    expect(s.elapsed - idleSince).toBeGreaterThanOrEqual(SHORE_TUNING.idleBackMs - 100);
    expect(s.elapsed - idleSince).toBeLessThanOrEqual(SHORE_TUNING.idleBackMs + 200);
    expect(runUntil(s, rng, () => s.mode === 'dock')).toBeGreaterThan(0);
    expect(s.paj.shape).toBe('sit');
    expect(chairEmpty(s)).toBe(false);
  });

  it('standing at the stones, another tap is another throw (no walking again); a tap mid-throw waits its turn', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'idle');
    throwUntilRelease(s, rng);
    expect(pebbleRequest(s, { skips: 4, side: 0.5, big: false }, 'idle')).toBe('queued'); // his hands are busy
    runUntil(s, rng, () => s.shore.phase === 'watch');
    pebbleLanded(s, 3, rng);
    // Straight on to the next pebble, no stop in between.
    expect(runUntil(s, rng, () => s.release !== null)).toBeGreaterThan(0);
    expect(takePebbleRelease(s)).toMatchObject({ skips: 4, side: 0.5 });
    runUntil(s, rng, () => s.shore.phase === 'watch');
    pebbleLanded(s, 4, rng);
    runUntil(s, rng, () => s.shore.phase === 'idle');
    expect(pebbleRequest(s, TAP, 'idle')).toBe('started'); // free hands: at once
    expect(s.shore.phase).toBe('pick');
    expect(s.mode).toBe('shore');
  });

  it('a fast swipe gets the bigger wind-up (a longer crouch); a tap the short one', () => {
    const wind = (t: PebbleThrow) => {
      const { s, rng } = fresh();
      pebbleRequest(s, t, 'idle');
      const crouched = { bend: false };
      let from = -1;
      for (let ms = 0; ms < 60_000 && s.release === null; ms += 50) {
        tickCompanions(s, 50, ctxOf('idle'), rng);
        if (s.shore.phase === 'windUp') {
          if (from < 0) from = ms;
          if ((s.paj.shape === 'pickUp' || s.paj.shape === 'pick')) crouched.bend = true;
        }
      }
      return { ms: s.shore.phaseMs, crouched: crouched.bend, total: SHORE_TUNING };
    };
    const small = wind(TAP);
    const big = wind(BIG);
    expect(small.crouched).toBe(false);
    expect(big.crouched).toBe(true);
    expect(SHORE_TUNING.windUpBigMs).toBeGreaterThan(SHORE_TUNING.windUpMs * 2);
  });

  it('a five: he cheers with a line, Bestia barks once; a lesser throw does not bark', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, BIG, 'idle');
    throwUntilRelease(s, rng);
    runUntil(s, rng, () => s.shore.phase === 'watch');
    expect(pebbleLanded(s, 5, rng).five).toBe(true);
    expect(s.woofMs).toBeGreaterThan(0);
    expect(s.rejoiceMs).toBeGreaterThan(0);
    expect(SKIP_FIVE_LINES).toContain(s.bubble?.text);
    tickCompanions(s, 50, ctxOf('idle'), rng);
    expect(s.paj.shape).toBe('rejoice');
    run(s, rng, 1000);
    expect(s.woofMs).toBe(0); // one bark, then quiet

    const b = fresh(7);
    pebbleRequest(b.s, TAP, 'idle');
    throwUntilRelease(b.s, b.rng);
    runUntil(b.s, b.rng, () => b.s.shore.phase === 'watch');
    expect(pebbleLanded(b.s, 3, b.rng).five).toBe(false);
    expect(b.s.woofMs).toBe(0);
  });

  it('a hook or a catch is cheered from where he stands; no more throws start once the fish is on', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'idle');
    throwUntilRelease(s, rng);
    pebbleRequest(s, TAP, 'idle'); // queued
    expect(s.shore.next).not.toBeNull();
    companionEvent(s, 'hooked');
    expect(s.shore.next).toBeNull();
    runUntil(s, rng, () => s.shore.phase === 'watch', 10_000, 'fighting');
    expect(runUntil(s, rng, () => s.paj.shape === 'rejoice', 5000, 'fighting')).toBeGreaterThanOrEqual(0);
    expect(s.mode).toBe('shore');
  });

  it('chair things wait for him: no sips while he is away, they come back once he sits again', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'idle');
    for (let ms = 0; ms < 30_000; ms += 50) {
      tickCompanions(s, 50, ctxOf('idle'), rng);
      expect(isSipShape(s.paj.shape)).toBe(false);
      expect(chairEmpty(s)).toBe(true);
      if (s.release) pebbleLanded(s, 2, rng); // (harmless unless watching)
      if (s.shore.phase === 'watch') pebbleLanded(s, 2, rng);
      if (s.mode === 'returning') break;
    }
    expect(runUntil(s, rng, () => s.mode === 'dock')).toBeGreaterThan(0);
    expect(chairEmpty(s)).toBe(false);
    let sipped = false;
    for (let ms = 0; ms < 20_000 && !sipped; ms += 50) {
      tickCompanions(s, 50, ctxOf('waiting'), rng);
      sipped = isSipShape(s.paj.shape);
    }
    expect(sipped).toBe(true);
  });
});

describe('busy, asleep, fishing', () => {
  it('mid-fetch: he finishes the round, says "One sec!", then comes over (his chair stays empty)', () => {
    const { s, rng } = fresh(6);
    startPlayNow(s);
    run(s, rng, 1000);
    expect(s.play.phase).toBe('throw');
    const rounds = s.roundsDone;
    expect(pebbleRequest(s, TAP, 'idle')).toBe('queued');
    expect(s.bubble?.text).toBe(ONE_SEC_LINE);
    expect(s.mode).toBe('play');
    expect(runUntil(s, rng, () => s.mode === 'shore')).toBeGreaterThan(0);
    expect(s.roundsDone).toBe(rounds + 1); // the round was played to its end, and counted
    expect(s.stick.state).toBe('hidden');
    throwUntilRelease(s, rng);
  });

  it('between two rounds he goes at once', () => {
    const { s, rng } = fresh(6);
    startPlayNow(s);
    expect(runUntil(s, rng, () => s.play.phase === 'rest' || s.play.phase === 'toStick', 200_000)).toBeGreaterThan(0);
    pebbleRequest(s, TAP, 'idle');
    tickCompanions(s, 50, ctxOf('idle'), rng);
    expect(s.mode).toBe('shore');
  });

  it('mid-walk (going out to the grass, or back to the chair): he finishes the walk, then comes over, without starting a round', () => {
    for (const walk of ['leaving', 'returning'] as const) {
      const { s, rng } = fresh(3);
      if (walk === 'leaving') {
        run(s, rng, 25_500);
        expect(s.mode).toBe('leaving');
      } else {
        startPlayNow(s);
        expect(runUntil(s, rng, () => s.play.phase === 'rest' || s.play.phase === 'toStick', 200_000)).toBeGreaterThan(0);
        companionPress(s); // between rounds: they walk back at once
        expect(s.mode).toBe('returning');
      }
      expect(pebbleRequest(s, TAP, 'idle')).toBe('queued');
      expect(s.bubble?.text).toBe(ONE_SEC_LINE);
      let sawPlayRound = false;
      expect(
        runUntil(s, rng, () => {
          if (s.mode === 'play' && s.play.phase === 'throw') sawPlayRound = true;
          return s.release !== null;
        }, 120_000),
      ).toBeGreaterThan(0);
      expect(sawPlayRound).toBe(false);
      expect(s.mode).toBe('shore');
    }
  });

  it('in the car or asleep the stones do nothing; nor on the way to bed', () => {
    const { s } = fresh();
    startInCar(s);
    expect(pebbleRequest(s, TAP, 'idle')).toBe('no');
    expect(s.mode).toBe('bed');
    const d = fresh();
    startBedtime(d.s, 'Bed');
    expect(pebbleRequest(d.s, TAP, 'idle')).toBe('no');
  });

  it('during a fight (or the catch card, a cast in the air) no new throw starts', () => {
    for (const k of ['fighting', 'caught', 'charging', 'retrieving', 'lost']) {
      const { s } = fresh();
      expect(pebbleRequest(s, TAP, k)).toBe('no');
      expect(s.mode).toBe('dock');
    }
    for (const k of ['idle', 'waiting', 'casting', 'bite']) expect(pebbleRequest(fresh().s, TAP, k)).toBe('started');
  });

  it('at the stones, a throw queued before the fish was hooked and a fight that starts: nothing more is thrown', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'idle');
    throwUntilRelease(s, rng);
    pebbleRequest(s, TAP, 'idle');
    runUntil(s, rng, () => s.shore.phase === 'watch');
    pebbleLanded(s, 3, rng);
    // The fight began meanwhile: the queued throw is not started.
    run(s, rng, 20_000, 'fighting');
    expect(s.release).toBeNull();
    expect(s.mode).toBe('shore');
    // Once the fight is over the queued throw is let go (a fresh tap is needed) or he goes on as usual.
  });

  it('bedtime at the stones ends the outing at once', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'idle');
    run(s, rng, 3000);
    startBedtime(s, 'Bed');
    expect(s.mode).toBe('bed');
    expect(s.pebbleWant).toBeNull();
    expect(s.shore.cur).toBeNull();
  });
});

describe('the fight', () => {
  it('the hook press does not send him back from the stones', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'waiting');
    run(s, rng, 3000);
    companionPress(s, 'bite');
    companionPress(s, 'fighting');
    expect(s.mode).toBe('shore');
    expect(s.shore.leave).toBe(false);
  });

  it('his walk-back timer stands still during a fight and the catch card, then runs on', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'idle');
    throwUntilRelease(s, rng);
    runUntil(s, rng, () => s.shore.phase === 'watch');
    pebbleLanded(s, 3, rng);
    runUntil(s, rng, () => s.shore.phase === 'idle');
    companionEvent(s, 'hooked');
    run(s, rng, 30_000, 'fighting');
    expect(s.mode).toBe('shore');
    run(s, rng, 30_000, 'caught');
    expect(s.mode).toBe('shore');
    expect(runUntil(s, rng, () => s.mode === 'returning', 20_000, 'idle')).toBeGreaterThan(0);
  });
});

describe('casting no longer breaks up fetch', () => {
  it('a cast mid-round: the round is played to its end and counted, then they walk back, and no new round starts', () => {
    const { s, rng } = fresh(6);
    startPlayNow(s);
    run(s, rng, 1000);
    expect(s.play.phase).toBe('throw');
    const rounds = s.roundsDone;
    companionPress(s);
    expect(s.mode).toBe('play'); // not sent back at once
    let throws = 0;
    let last = s.play.phase;
    expect(
      runUntil(s, rng, () => {
        if (s.mode === 'play' && s.play.phase !== last) {
          if (s.play.phase === 'throw') throws++;
          last = s.play.phase;
        }
        return s.mode === 'returning';
      }, 60_000, 'waiting'),
    ).toBeGreaterThan(0);
    expect(s.roundsDone).toBe(rounds + 1);
    expect(throws).toBe(0);
    expect(runUntil(s, rng, () => s.mode === 'dock', 30_000, 'waiting')).toBeGreaterThan(0);
    expect(s.paj.shape).toBe('sit');
  });

  it('a Museum stick can still drop: the round is counted for the stick counter when the cast came mid-round', () => {
    const { s, rng } = fresh(2);
    startPlayNow(s);
    run(s, rng, 1500);
    companionPress(s);
    runUntil(s, rng, () => s.mode === 'dock', 60_000, 'waiting');
    expect(s.roundsDone).toBe(1);
  });

  it('a cast between rounds sends them back at once', () => {
    const { s, rng } = fresh(6);
    startPlayNow(s);
    expect(runUntil(s, rng, () => s.play.phase === 'rest' || s.play.phase === 'toStick', 200_000)).toBeGreaterThan(0);
    companionPress(s);
    expect(s.mode).toBe('returning');
  });

  it('a hook during the round is cheered from where he stands, the round goes on', () => {
    const { s, rng } = fresh(6);
    startPlayNow(s);
    run(s, rng, 1000);
    companionPress(s);
    companionEvent(s, 'bite');
    companionEvent(s, 'hooked');
    expect(s.mode).toBe('play');
    tickCompanions(s, 50, ctxOf('fighting'), rng);
    expect(s.paj.shape).toBe('rejoice');
  });

  it('a cast at the stones: he finishes the throw in hand, then walks back', () => {
    const { s, rng } = fresh();
    pebbleRequest(s, TAP, 'idle');
    expect(runUntil(s, rng, () => s.shore.phase === 'windUp')).toBeGreaterThan(0);
    companionPress(s);
    expect(s.mode).toBe('shore');
    expect(takePebbleRelease(s)).toBeNull();
    expect(runUntil(s, rng, () => s.release !== null, 5000, 'charging')).toBeGreaterThanOrEqual(0); // the throw in hand still goes
    takePebbleRelease(s);
    runUntil(s, rng, () => s.shore.phase === 'watch', 5000, 'waiting');
    pebbleLanded(s, 2, rng);
    expect(runUntil(s, rng, () => s.mode === 'returning', 10_000, 'waiting')).toBeGreaterThan(0);
    expect(runUntil(s, rng, () => s.mode === 'dock', 30_000, 'waiting')).toBeGreaterThan(0);
  });

  it('a cast while he walks to the stones or stands there with nothing in hand: back at once', () => {
    const a = fresh();
    pebbleRequest(a.s, TAP, 'idle');
    run(a.s, a.rng, 300);
    companionPress(a.s);
    expect(a.s.mode).toBe('returning');
    const b = fresh();
    pebbleRequest(b.s, TAP, 'idle');
    throwUntilRelease(b.s, b.rng);
    runUntil(b.s, b.rng, () => b.s.shore.phase === 'watch');
    pebbleLanded(b.s, 3, b.rng);
    runUntil(b.s, b.rng, () => b.s.shore.phase === 'idle');
    companionPress(b.s);
    expect(b.s.mode).toBe('returning');
  });
});

describe('where the pebble flies', () => {
  it('out over the LEFT water: every touch-down is left of the dock, rising up the screen, from his hand', () => {
    for (const skips of [1, 2, 3, 4, 5]) {
      for (const side of [-1, 0, 1]) {
        const from = { x: 67, y: 457 };
        const route = pebbleRoute(skips, side, from);
        expect(route).toHaveLength(skips + 1);
        for (const pt of route) {
          expect(pt.x).toBeLessThan(116); // the dock's left edge
          expect(pt.x).toBeGreaterThanOrEqual(10);
          expect(pt.y).toBeLessThan(from.y);
        }
        for (let i = 1; i < route.length; i++) expect(route[i].y).toBeLessThan(route[i - 1].y); // further = higher
      }
    }
  });

  it('a swipe to the right drifts it right, to the left drifts it left', () => {
    const l = pebbleRoute(4, -1, { x: 67, y: 457 });
    const r = pebbleRoute(4, 1, { x: 67, y: 457 });
    expect(r[r.length - 1].x).toBeGreaterThan(l[l.length - 1].x);
  });
});

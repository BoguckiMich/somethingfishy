import { describe, expect, it } from 'vitest';
import { CHARGE_HALF_CYCLE_MS } from './casting';
import { QUIET_LAKE } from './data/locations';
import { RODS } from './data/rods';
import type { GameEvent } from './events';
import {
  BITE_TUNING,
  INITIAL_STATE,
  step,
  type FishingInput,
  type FishingState,
  type SessionContext,
} from './fishingSession';
import { zoneAt } from './location';
import { seededRng, type Rng } from './random';

const [bamboo, , carbon] = RODS;

function ctxWith(rod = bamboo, rng: Rng = seededRng(1)): SessionContext {
  return { location: QUIET_LAKE, rod, rng };
}

/** Feeds inputs one by one, collecting every emitted event. */
function run(inputs: FishingInput[], ctx: SessionContext, from: FishingState = INITIAL_STATE) {
  let state = from;
  const events: GameEvent[] = [];
  for (const input of inputs) {
    const r = step(state, input, ctx);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

/** Ticks in small steps until `until(state)` holds (or gives up). */
function tickUntil(state: FishingState, ctx: SessionContext, until: (s: FishingState) => boolean) {
  const events: GameEvent[] = [];
  for (let i = 0; i < 10_000 && !until(state); i++) {
    const r = step(state, { type: 'tick', dtMs: 16 }, ctx);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

const fullPowerCast: FishingInput[] = [
  { type: 'press' },
  { type: 'tick', dtMs: CHARGE_HALF_CYCLE_MS },
  { type: 'release' },
];

const castAndLand: FishingInput[] = [...fullPowerCast, { type: 'landed' }];

describe('casting', () => {
  it('starter rod at full power stays in shallow water and emits a cast event', () => {
    const { state, events } = run(fullPowerCast, ctxWith());
    expect(state).toMatchObject({ kind: 'casting', zone: 'shallow', distanceM: bamboo.maxCastM });
    expect(events).toEqual([{ type: 'cast', distanceM: bamboo.maxCastM, zone: 'shallow', locationId: QUIET_LAKE.id }]);
  });

  it('best rod at full power reaches deep water', () => {
    expect(run(fullPowerCast, ctxWith(carbon)).state).toMatchObject({ kind: 'casting', zone: 'deep' });
  });

  it('ignores inputs that do not apply to the current state', () => {
    const ctx = ctxWith();
    expect(step(INITIAL_STATE, { type: 'release' }, ctx).state).toBe(INITIAL_STATE);
    const casting = run(fullPowerCast, ctx).state;
    expect(step(casting, { type: 'press' }, ctx).state).toBe(casting);
  });
});

describe('waiting and bites', () => {
  it('landing starts a wait with a scheduled bite within the tuning ranges', () => {
    const { state } = run(castAndLand, ctxWith());
    expect(state.kind).toBe('waiting');
    if (state.kind !== 'waiting') return;
    expect(state.untilMs).toBeGreaterThanOrEqual(BITE_TUNING.firstWaitMs[0]);
    expect(state.untilMs).toBeLessThan(BITE_TUNING.firstWaitMs[1]);
    expect(state.nibblesLeft).toBeGreaterThanOrEqual(BITE_TUNING.nibbles[0]);
    expect(state.nibblesLeft).toBeLessThanOrEqual(BITE_TUNING.nibbles[1]);
  });

  it('emits every scheduled nibble, then exactly one bite', () => {
    const ctx = ctxWith();
    const waiting: FishingState = {
      kind: 'waiting', distanceM: 5, zone: 'shallow', untilMs: 3000, nibblesLeft: 2, hadNibble: false,
    };
    const { state, events } = tickUntil(waiting, ctx, (s) => s.kind === 'bite');
    expect(state.kind).toBe('bite');
    expect(events.filter((e) => e.type === 'nibble')).toHaveLength(2);
    expect(events.at(-1)).toEqual({ type: 'bite' });
  });

  it('tapping during the bite window hooks the fish', () => {
    const ctx = ctxWith();
    const bite = tickUntil(run(castAndLand, ctx).state, ctx, (s) => s.kind === 'bite').state;
    const { state, events } = run([{ type: 'press' }], ctx, bite);
    expect(state).toMatchObject({ kind: 'hooked', zone: 'shallow' });
    expect(events).toEqual([{ type: 'hooked', zone: 'shallow' }]);
  });

  it('missing the bite window lets the fish escape', () => {
    const ctx = ctxWith();
    const bite = tickUntil(run(castAndLand, ctx).state, ctx, (s) => s.kind === 'bite').state;
    const { state, events } = run([{ type: 'tick', dtMs: BITE_TUNING.hookWindowMs }], ctx, bite);
    expect(state.kind).toBe('retrieving');
    expect(events).toEqual([{ type: 'fishEscaped', reason: 'tooLate' }]);
  });

  it('tapping after a nibble but before the bite scares the fish off', () => {
    const ctx = ctxWith();
    const waiting: FishingState = {
      kind: 'waiting', distanceM: 5, zone: 'shallow', untilMs: 1000, nibblesLeft: 1, hadNibble: true,
    };
    const { state, events } = run([{ type: 'press' }], ctx, waiting);
    expect(state.kind).toBe('retrieving');
    expect(events).toEqual([{ type: 'fishEscaped', reason: 'tooEarly' }]);
  });

  it('tapping before any nibble just reels in quietly', () => {
    const ctx = ctxWith();
    const { state, events } = run([...castAndLand, { type: 'press' }], ctx);
    expect(state.kind).toBe('retrieving');
    expect(events.filter((e) => e.type === 'fishEscaped')).toEqual([]);
  });

  it('a full round trip returns to idle', () => {
    const ctx = ctxWith();
    const bite = tickUntil(run(castAndLand, ctx).state, ctx, (s) => s.kind === 'bite').state;
    const { state } = run([{ type: 'press' }, { type: 'press' }, { type: 'retrieved' }], ctx, bite);
    expect(state).toEqual(INITIAL_STATE);
  });
});

describe('zoneAt', () => {
  it('maps distances to zones, clamping past the end', () => {
    expect(zoneAt(QUIET_LAKE, 0).id).toBe('shallow');
    expect(zoneAt(QUIET_LAKE, 14.9).id).toBe('shallow');
    expect(zoneAt(QUIET_LAKE, 15).id).toBe('deep');
    expect(zoneAt(QUIET_LAKE, 999).id).toBe('deep');
  });
});

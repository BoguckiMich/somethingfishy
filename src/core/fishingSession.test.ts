import { describe, expect, it } from 'vitest';
import { CHARGE_HALF_CYCLE_MS } from './casting';
import type { FishProfile } from './catchBar';
import { STARTER_BAR_GEAR } from './data/barGear';
import { speciesById } from './data/fish';
import { fightProfile, weightG, type HookedFish } from './fish';
import { QUIET_LAKE } from './data/locations';
import { RODS } from './data/rods';
import type { GameEvent } from './events';
import {
  BITE_TUNING,
  FIGHT_TUNING,
  INITIAL_STATE,
  step,
  type FishingInput,
  type FishingState,
  type SessionContext,
} from './fishingSession';
import { zoneAt } from './location';
import { seededRng, type Rng } from './random';

const [bamboo, , carbon] = RODS;
const PERCH: HookedFish = { speciesId: 'perch', lengthCm: 24, weightG: 210 };

function ctxWith(rod = bamboo, rng: Rng = seededRng(1)): SessionContext {
  return { location: QUIET_LAKE, rod, barGear: STARTER_BAR_GEAR, rng, timeOfDay: () => 'day' };
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
    const species = speciesById(state.hooked.speciesId)!;
    expect(state.nibblesLeft).toBeGreaterThanOrEqual(species.nibbles[0]);
    expect(state.nibblesLeft).toBeLessThanOrEqual(species.nibbles[1]);
  });

  it('the species is picked when the bobber lands, from the zone and the time of day', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const night = { ...ctxWith(bamboo, seededRng(seed)), timeOfDay: () => 'night' as const };
      const { state } = run(castAndLand, night);
      if (state.kind !== 'waiting') throw new Error('expected waiting');
      const sp = speciesById(state.hooked.speciesId)!;
      expect(sp.zone).toBe('shallow');
      expect(sp.times).toContain('night');
      expect(state.hooked.lengthCm).toBeGreaterThanOrEqual(sp.lengthCm[0]);
      expect(state.hooked.lengthCm).toBeLessThanOrEqual(sp.lengthCm[1]);
      expect(state.hooked.weightG).toBe(weightG(sp, state.hooked.lengthCm));
    }
  });

  it('deep water rolls deep species', () => {
    const { state } = run(castAndLand, ctxWith(carbon));
    expect(state.kind === 'waiting' && speciesById(state.hooked.speciesId)!.zone).toBe('deep');
  });

  it('a speciesOverride forces the species', () => {
    const ctx = { ...ctxWith(), speciesOverride: 'catfish' };
    const { state } = run(castAndLand, ctx);
    expect(state.kind === 'waiting' && state.hooked.speciesId).toBe('catfish');
  });

  it('the same fish is carried from waiting through bite to the fight', () => {
    const ctx = ctxWith();
    const waiting = run(castAndLand, ctx).state;
    const bite = tickUntil(waiting, ctx, (s) => s.kind === 'bite').state;
    const fighting = run([{ type: 'press' }], ctx, bite).state;
    if (waiting.kind !== 'waiting' || bite.kind !== 'bite' || fighting.kind !== 'fighting') throw new Error('unexpected states');
    expect(bite.hooked).toEqual(waiting.hooked);
    expect(fighting.hooked).toEqual(waiting.hooked);
    const sp = speciesById(waiting.hooked.speciesId)!;
    expect(fighting.fish).toEqual(fightProfile(sp, waiting.hooked.lengthCm));
  });

  it('emits every scheduled nibble, then exactly one bite', () => {
    const ctx = ctxWith();
    const waiting: FishingState = {
      kind: 'waiting', distanceM: 5, zone: 'shallow', hooked: PERCH, untilMs: 3000, nibblesLeft: 2, hadNibble: false,
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
    expect(state).toMatchObject({ kind: 'fighting', zone: 'shallow' });
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
      kind: 'waiting', distanceM: 5, zone: 'shallow', hooked: PERCH, untilMs: 1000, nibblesLeft: 1, hadNibble: true,
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
    const fighting = run([{ type: 'press' }], ctx, bite).state;
    const lost = tickUntil(fighting, ctx, (s) => s.kind === 'lost').state;
    const retrieving = tickUntil(lost, ctx, (s) => s.kind === 'retrieving').state;
    expect(run([{ type: 'retrieved' }], ctx, retrieving).state).toEqual(INITIAL_STATE);
  });
});

const EASY: FishProfile = { pattern: 'smooth', difficulty: 0.05 };
const biteState: FishingState = { kind: 'bite', distanceM: 10, zone: 'shallow', hooked: PERCH, windowLeftMs: 1000 };

/** A fight where the player just holds the bar on the fish (cheats by reading the state). */
function fightUntil(ctx: SessionContext, until: (s: FishingState) => boolean, play: 'hold' | 'idle') {
  let state = run([{ type: 'press' }], ctx, biteState).state;
  const events: GameEvent[] = [];
  for (let i = 0; i < 20_000 && !until(state); i++) {
    if (state.kind === 'fighting') {
      const wantHold = play === 'hold' && state.bar.fish > state.bar.zone;
      if (wantHold !== state.bar.holding) {
        const r = step(state, { type: wantHold ? 'press' : 'release' }, ctx);
        state = r.state;
      }
    }
    const r = step(state, { type: 'tick', dtMs: 16 }, ctx);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

describe('the fight', () => {
  it('starts with the hooking press still down and the species fight profile', () => {
    const { state } = run([{ type: 'press' }], ctxWith(), biteState);
    expect(state.kind).toBe('fighting');
    if (state.kind !== 'fighting') return;
    expect(state.bar.holding).toBe(true);
    expect(state.bar.progress).toBe(0.3);
    expect(state.fish).toEqual(fightProfile(speciesById('perch')!, 24));
    expect(state.fish.difficulty).toBeLessThanOrEqual(0.3); // shallow
  });

  it('uses the dev fish override when given', () => {
    const ctx = { ...ctxWith(), fishOverride: { pattern: 'erratic', difficulty: 0.77 } satisfies FishProfile };
    const { state } = run([{ type: 'press' }], ctx, biteState);
    expect(state).toMatchObject({ kind: 'fighting', fish: { pattern: 'erratic', difficulty: 0.77 } });
  });

  it('press and release set holding, and ticks move the bar', () => {
    const ctx = ctxWith();
    let state = run([{ type: 'press' }], ctx, biteState).state;
    state = run([{ type: 'release' }], ctx, state).state;
    expect(state.kind === 'fighting' && state.bar.holding).toBe(false);
    state = run([{ type: 'press' }, { type: 'tick', dtMs: 200 }], ctx, state).state;
    expect(state.kind === 'fighting' && state.bar.zone).toBeGreaterThan(STARTER_BAR_GEAR.zoneSize / 2);
    expect(state.kind === 'fighting' && state.bar.elapsedMs).toBeGreaterThan(150);
  });

  it('a filled bar catches the fish: show-off state and a fishCaught event', () => {
    const ctx = { ...ctxWith(), fishOverride: EASY };
    const { state, events } = fightUntil(ctx, (s) => s.kind === 'caught', 'hold');
    expect(state).toMatchObject({ kind: 'caught', zone: 'shallow', shownMs: 0 });
    const caught = events.filter((e) => e.type === 'fishCaught');
    expect(caught).toHaveLength(1);
    expect(caught[0]).toMatchObject({ zone: 'shallow', pattern: 'smooth', difficulty: 0.05, speciesId: 'perch', lengthCm: 24, weightG: 210 });
    expect((caught[0] as { fightMs: number }).fightMs).toBeGreaterThan(2000);
  });

  it('the show-off ignores a press until the guard time, then a press dismisses it', () => {
    const ctx = ctxWith();
    const caught: FishingState = { kind: 'caught', distanceM: 10, zone: 'shallow', hooked: PERCH, fish: EASY, shownMs: 0 };
    let state = run([{ type: 'press' }], ctx, caught).state;
    expect(state.kind).toBe('caught');
    state = run([{ type: 'tick', dtMs: FIGHT_TUNING.showOffGuardMs }, { type: 'press' }], ctx, caught).state;
    expect(state).toEqual(INITIAL_STATE);
  });

  it('the show-off ends by itself after 4 s', () => {
    const ctx = ctxWith();
    const caught: FishingState = { kind: 'caught', distanceM: 10, zone: 'shallow', hooked: PERCH, fish: EASY, shownMs: 0 };
    expect(run([{ type: 'tick', dtMs: 3900 }], ctx, caught).state.kind).toBe('caught');
    expect(run([{ type: 'tick', dtMs: 3900 }, { type: 'tick', dtMs: 200 }], ctx, caught).state).toEqual(INITIAL_STATE);
  });

  it('an empty bar loses the fish: slack line, a fishLost event, presses ignored, then the reel-in', () => {
    const ctx = { ...ctxWith(), fishOverride: { pattern: 'floater', difficulty: 0.2 } satisfies FishProfile };
    const { state, events } = fightUntil(ctx, (s) => s.kind === 'lost', 'idle');
    expect(state).toMatchObject({ kind: 'lost', distanceM: 10 });
    expect(events.filter((e) => e.type === 'fishLost')).toEqual([{ type: 'fishLost', zone: 'shallow', pattern: 'floater', difficulty: 0.2, speciesId: 'perch' }]);
    expect(step(state, { type: 'press' }, ctx).state).toBe(state);
    const mid = step(state, { type: 'tick', dtMs: FIGHT_TUNING.slackMs - 50 }, ctx).state;
    expect(mid.kind).toBe('lost');
    expect(step(mid, { type: 'tick', dtMs: 60 }, ctx).state).toEqual({ kind: 'retrieving', distanceM: 10 });
  });
});

describe('forced species fight with their own pattern', () => {
  it('the bar uses the species pattern', () => {
    for (const sp of [speciesById('eel')!, speciesById('pike')!]) {
      const ctx = { ...ctxWith(carbon), speciesOverride: sp.id };
      const waiting = run(castAndLand, ctx).state;
      const bite = tickUntil(waiting, ctx, (s) => s.kind === 'bite').state;
      const fighting = run([{ type: 'press' }], ctx, bite).state;
      expect(fighting.kind === 'fighting' && fighting.fish.pattern).toBe(sp.pattern);
    }
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

describe('casting needs a worm', () => {
  it('a press in idle does not start charging when canCast says no', () => {
    const ctx = { ...ctxWith(), canCast: () => false };
    const r = step(INITIAL_STATE, { type: 'press' }, ctx);
    expect(r.state).toBe(INITIAL_STATE);
  });
  it('charges as usual when canCast says yes (or is not given)', () => {
    expect(step(INITIAL_STATE, { type: 'press' }, { ...ctxWith(), canCast: () => true }).state.kind).toBe('charging');
    expect(step(INITIAL_STATE, { type: 'press' }, ctxWith()).state.kind).toBe('charging');
  });
});

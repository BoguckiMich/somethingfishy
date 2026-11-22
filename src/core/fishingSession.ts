import { castDistance, chargePower } from './casting';
import { barResult, newCatchBar, placeholderFish, tickCatchBar, type CatchBarState, type FishProfile } from './catchBar';
import type { GameEvent } from './events';
import type { BarGear, Rod } from './gear';
import { zoneAt, type Location, type ZoneId } from './location';
import type { Rng } from './random';
import { randInt, randRange } from './random';

/**
 * The float-fishing state machine. Pure: the scene sends events in and renders whatever
 * state comes out. Animations (cast arc, reel-in) are owned by the scene, which reports
 * their end with `landed` / `retrieved`. Randomness comes from the injected `rng`.
 */
export type FishingState =
  | { kind: 'idle' }
  | { kind: 'charging'; heldMs: number }
  | { kind: 'casting'; power: number; distanceM: number; zone: ZoneId }
  /** Bobber in the water. `untilMs` counts down to the next nibble or the real bite. */
  | { kind: 'waiting'; distanceM: number; zone: ZoneId; untilMs: number; nibblesLeft: number; hadNibble: boolean }
  /** The real bite: the bobber is under and the player must tap within `windowLeftMs`. */
  | { kind: 'bite'; distanceM: number; zone: ZoneId; windowLeftMs: number }
  /** The catch-bar fight. Holding raises the zone; `bar.holding` mirrors the player's thumb. */
  | { kind: 'fighting'; distanceM: number; zone: ZoneId; fish: FishProfile; bar: CatchBarState }
  /** The show-off: the fish is held up. A press (after a short guard) or the timer ends it. */
  | { kind: 'caught'; distanceM: number; zone: ZoneId; fish: FishProfile; shownMs: number }
  /** The fish got away: the line hangs slack for a moment, then the normal reel-in follows. */
  | { kind: 'lost'; distanceM: number; ageMs: number }
  | { kind: 'retrieving'; distanceM: number };

export type FishingInput =
  | { type: 'press' }
  | { type: 'release' }
  | { type: 'tick'; dtMs: number }
  | { type: 'landed' }
  | { type: 'retrieved' };

export interface SessionContext {
  location: Location;
  rod: Rod;
  /** What the gear does to the catch bar. */
  barGear: BarGear;
  rng: Rng;
  /** Dev flag: forces the fish (pattern and difficulty) instead of the zone's placeholder pick. */
  fishOverride?: FishProfile;
}

/** Bite timing. Will become per-species once fish data exists. */
export const BITE_TUNING = {
  /** Wait before the first nibble (or the bite, if there are no nibbles). */
  firstWaitMs: [2500, 8000] as [number, number],
  /** Number of fake-out nibbles before the real bite, inclusive range. */
  nibbles: [0, 3] as [number, number],
  /** Gap between nibbles, and between the last nibble and the bite. */
  nibbleGapMs: [600, 1600] as [number, number],
  /** How long the player has to tap once the real bite happens. */
  hookWindowMs: 1000,
};

export const FIGHT_TUNING = {
  /** A press ends the show-off only after this long (so the finger still holding from the fight doesn't skip it). */
  showOffGuardMs: 400,
  /** The show-off ends by itself after this long. */
  showOffMs: 3000,
  /** How long the line hangs slack after a lost fish, before the reel-in. */
  slackMs: 1000,
};

export interface StepResult {
  state: FishingState;
  /** What happened during this step, for the scene (sounds, haptics) and later for quests. */
  events: GameEvent[];
}

export const INITIAL_STATE: FishingState = { kind: 'idle' };

const same = (state: FishingState): StepResult => ({ state, events: [] });

export function step(state: FishingState, input: FishingInput, ctx: SessionContext): StepResult {
  switch (state.kind) {
    case 'idle':
      return input.type === 'press' ? same({ kind: 'charging', heldMs: 0 }) : same(state);

    case 'charging':
      if (input.type === 'tick') return same({ kind: 'charging', heldMs: state.heldMs + input.dtMs });
      if (input.type === 'release') {
        const power = chargePower(state.heldMs);
        const distanceM = castDistance(power, ctx.rod);
        const zone = zoneAt(ctx.location, distanceM).id;
        return {
          state: { kind: 'casting', power, distanceM, zone },
          events: [{ type: 'cast', distanceM, zone, locationId: ctx.location.id }],
        };
      }
      return same(state);

    case 'casting':
      if (input.type !== 'landed') return same(state);
      return same({
        kind: 'waiting',
        distanceM: state.distanceM,
        zone: state.zone,
        untilMs: randRange(ctx.rng, ...BITE_TUNING.firstWaitMs),
        nibblesLeft: randInt(ctx.rng, ...BITE_TUNING.nibbles),
        hadNibble: false,
      });

    case 'waiting': {
      if (input.type === 'press') {
        // Reeling in before the bite. If a fish was already nibbling, it gets scared off.
        return {
          state: { kind: 'retrieving', distanceM: state.distanceM },
          events: state.hadNibble ? [{ type: 'fishEscaped', reason: 'tooEarly' }] : [],
        };
      }
      if (input.type !== 'tick') return same(state);
      const untilMs = state.untilMs - input.dtMs;
      if (untilMs > 0) return same({ ...state, untilMs });
      if (state.nibblesLeft > 0) {
        return {
          state: {
            ...state,
            untilMs: randRange(ctx.rng, ...BITE_TUNING.nibbleGapMs),
            nibblesLeft: state.nibblesLeft - 1,
            hadNibble: true,
          },
          events: [{ type: 'nibble' }],
        };
      }
      return {
        state: { kind: 'bite', distanceM: state.distanceM, zone: state.zone, windowLeftMs: BITE_TUNING.hookWindowMs },
        events: [{ type: 'bite' }],
      };
    }

    case 'bite': {
      if (input.type === 'press') {
        const fish = ctx.fishOverride ?? placeholderFish(state.zone, ctx.rng);
        const bar = { ...newCatchBar(fish, ctx.barGear, ctx.rng), holding: true }; // the hooking press is still down
        return {
          state: { kind: 'fighting', distanceM: state.distanceM, zone: state.zone, fish, bar },
          events: [{ type: 'hooked', zone: state.zone }],
        };
      }
      if (input.type !== 'tick') return same(state);
      const windowLeftMs = state.windowLeftMs - input.dtMs;
      if (windowLeftMs > 0) return same({ ...state, windowLeftMs });
      return {
        state: { kind: 'retrieving', distanceM: state.distanceM },
        events: [{ type: 'fishEscaped', reason: 'tooLate' }],
      };
    }

    case 'fighting': {
      if (input.type === 'press' || input.type === 'release') {
        return same({ ...state, bar: { ...state.bar, holding: input.type === 'press' } });
      }
      if (input.type !== 'tick') return same(state);
      const bar = tickCatchBar(state.bar, input.dtMs, state.bar.holding, state.fish, ctx.barGear, ctx.rng);
      const result = barResult(bar);
      const { zone, fish, distanceM } = state;
      if (result === 'caught') {
        return {
          state: { kind: 'caught', distanceM, zone, fish, shownMs: 0 },
          events: [{ type: 'fishCaught', zone, pattern: fish.pattern, difficulty: fish.difficulty, fightMs: bar.elapsedMs }],
        };
      }
      if (result === 'lost') {
        return {
          state: { kind: 'lost', distanceM, ageMs: 0 },
          events: [{ type: 'fishLost', zone, pattern: fish.pattern, difficulty: fish.difficulty }],
        };
      }
      return same({ ...state, bar });
    }

    case 'caught': {
      if (input.type === 'press' && state.shownMs >= FIGHT_TUNING.showOffGuardMs) return same(INITIAL_STATE);
      if (input.type !== 'tick') return same(state);
      const shownMs = state.shownMs + input.dtMs;
      return same(shownMs >= FIGHT_TUNING.showOffMs ? INITIAL_STATE : { ...state, shownMs });
    }

    case 'lost': {
      if (input.type !== 'tick') return same(state); // presses are ignored while the line hangs slack
      const ageMs = state.ageMs + input.dtMs;
      return same(ageMs >= FIGHT_TUNING.slackMs ? { kind: 'retrieving', distanceM: state.distanceM } : { ...state, ageMs });
    }

    case 'retrieving':
      return input.type === 'retrieved' ? same(INITIAL_STATE) : same(state);
  }
}

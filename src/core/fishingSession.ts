import { castDistance, chargePower } from './casting';
import type { GameEvent } from './events';
import type { Rod } from './gear';
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
  /** Fish on the hook. The catch-bar fight starts here (slice 4); for now a tap reels in. */
  | { kind: 'hooked'; distanceM: number; zone: ZoneId }
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
  rng: Rng;
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
        return {
          state: { kind: 'hooked', distanceM: state.distanceM, zone: state.zone },
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

    case 'hooked':
      // Placeholder until the catch bar (slice 4): tap to reel the fish in.
      return input.type === 'press' ? same({ kind: 'retrieving', distanceM: state.distanceM }) : same(state);

    case 'retrieving':
      return input.type === 'retrieved' ? same(INITIAL_STATE) : same(state);
  }
}

import { castDistance, chargePower, MIN_HOLD_MS } from './casting';
import { barResult, newCatchBar, tickCatchBar, type CatchBarState, type FishProfile } from './catchBar';
import type { TimeOfDay } from './clock';
import { speciesById } from './data/fish';
import type { GameEvent } from './events';
import { baitById } from './data/baits';
import type { WeatherEffects } from './daily/weather';
import { fightProfile, rollHookedFish, type HookedFish } from './fish';
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
  | { kind: 'waiting'; distanceM: number; zone: ZoneId; hooked: HookedFish; untilMs: number; nibblesLeft: number; hadNibble: boolean }
  /** The real bite: the bobber is under and the player must tap within `windowLeftMs`. */
  | { kind: 'bite'; distanceM: number; zone: ZoneId; hooked: HookedFish; windowLeftMs: number }
  /** The catch-bar fight. Holding raises the zone; `bar.holding` mirrors the player's thumb. */
  | { kind: 'fighting'; distanceM: number; zone: ZoneId; hooked: HookedFish; fish: FishProfile; bar: CatchBarState }
  /** The show-off: the fish is held up. A press (after a short guard) or the timer ends it. */
  | { kind: 'caught'; distanceM: number; zone: ZoneId; hooked: HookedFish; fish: FishProfile; shownMs: number }
  /** The fish got away: the line hangs slack for a moment, then the normal reel-in follows. */
  | { kind: 'lost'; distanceM: number; ageMs: number }
  | { kind: 'retrieving'; distanceM: number };

export type FishingInput =
  | { type: 'press' }
  | { type: 'release' }
  /** The browser took the touch away (pointercancel, long-press menu, leaving the canvas on a phone): charging stops with no cast, a held fight press lets go. */
  | { type: 'cancel' }
  | { type: 'tick'; dtMs: number }
  | { type: 'landed' }
  | { type: 'retrieved' };

export interface SessionContext {
  location: Location;
  rod: Rod;
  /** What the equipped rod does to the catch bar. */
  barGear: BarGear;
  /** Asked before a cast starts charging (out of worms: no). Absent means always. */
  canCast?: () => boolean;
  rng: Rng;
  /** The bait on the hook (slice 15c): undefined or 'worm' is the plain worm. Absent means worms. */
  baitId?: () => string | undefined;
  /** Today's fish (slice 19): bites more. Absent means none. */
  fotdId?: () => string | undefined;
  /** Today's weather and what it does to the bites right now (slice 23b). Absent means none. */
  weatherFx?: () => WeatherEffects | undefined;
  /** The current time of day, from the scene's clock (core stays free of the clock itself). */
  timeOfDay: () => TimeOfDay;
  /** The in-game minute of the day; the legendary's clock window needs it. Absent means no legendary. */
  minute?: () => number;
  /** Dev flag: forces the bar profile (pattern and difficulty) instead of the species' own. */
  fishOverride?: FishProfile;
  /** How long the show-off lasts (default FIGHT_TUNING.showOffMs); the scene lengthens it for a new species. */
  showOffMs?: number;
  /** Dev flag: forces the species that bites. */
  speciesOverride?: string;
}

/** Bite timing. The number of nibbles comes from the species. */
export const BITE_TUNING = {
  /** Wait before the first nibble (or the bite, if there are no nibbles). */
  firstWaitMs: [2500, 8000] as [number, number],
  /** Gap between nibbles, and between the last nibble and the bite. */
  nibbleGapMs: [600, 1600] as [number, number],
  /** How long the player has to tap once the real bite happens. */
  hookWindowMs: 1000,
};

export const FIGHT_TUNING = {
  /** A press ends the show-off only after this long (so the finger still holding from the fight doesn't skip it). */
  showOffGuardMs: 400,
  /** The show-off ends by itself after this long. */
  showOffMs: 4000,
  /** How long the line hangs slack after a lost fish, before the reel-in. */
  slackMs: 1000,
};

export interface StepResult {
  state: FishingState;
  /** What happened during this step, for the scene (sounds, haptics) and later for quests. */
  events: GameEvent[];
}

/** Maggots (slice 15c) shorten the first wait, in shallow water only; every other case is x1. */
export function firstWaitFactor(baitId: string | undefined, zone: ZoneId): number {
  const w = baitById(baitId)?.waitFactor;
  return w && w.zone === zone ? w.factor : 1;
}

export const INITIAL_STATE: FishingState = { kind: 'idle' };

const same = (state: FishingState): StepResult => ({ state, events: [] });

export function step(state: FishingState, input: FishingInput, ctx: SessionContext): StepResult {
  switch (state.kind) {
    case 'idle':
      if (input.type !== 'press' || (ctx.canCast && !ctx.canCast())) return same(state);
      return same({ kind: 'charging', heldMs: 0 });

    case 'charging':
      if (input.type === 'tick') return same({ kind: 'charging', heldMs: state.heldMs + input.dtMs });
      if (input.type === 'cancel') return same(INITIAL_STATE);
      if (input.type === 'release') {
        // Too short a hold is a tap: back to idle, no cast and (the bait is used on the cast event) no bait spent.
        if (state.heldMs < MIN_HOLD_MS) return same(INITIAL_STATE);
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
      // The fish is chosen as the bobber lands: its species shapes the wait (shy fish nibble more).
      const bait = ctx.baitId?.();
      const fx = ctx.weatherFx?.();
      const hooked = rollHookedFish(
        state.zone,
        ctx.timeOfDay(),
        ctx.rng,
        ctx.speciesOverride,
        ctx.minute ? { distanceM: state.distanceM, minute: ctx.minute() } : undefined,
        bait,
        ctx.fotdId?.(),
        fx,
      );
      return same({
        kind: 'waiting',
        distanceM: state.distanceM,
        zone: state.zone,
        hooked,
        untilMs: randRange(ctx.rng, ...BITE_TUNING.firstWaitMs) * firstWaitFactor(bait, state.zone) * (fx?.waitFactor ?? 1),
        nibblesLeft: randInt(ctx.rng, ...speciesById(hooked.speciesId)!.nibbles),
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
        state: { kind: 'bite', distanceM: state.distanceM, zone: state.zone, hooked: state.hooked, windowLeftMs: BITE_TUNING.hookWindowMs },
        events: [{ type: 'bite' }],
      };
    }

    case 'bite': {
      if (input.type === 'press') {
        const fish = ctx.fishOverride ?? fightProfile(speciesById(state.hooked.speciesId)!, state.hooked.lengthCm, ctx.weatherFx?.()?.difficultyAdd);
        const bar = { ...newCatchBar(fish, ctx.barGear, ctx.rng), holding: true }; // the hooking press is still down
        return {
          state: { kind: 'fighting', distanceM: state.distanceM, zone: state.zone, hooked: state.hooked, fish, bar },
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
      if (input.type === 'press' || input.type === 'release' || input.type === 'cancel') {
        return same({ ...state, bar: { ...state.bar, holding: input.type === 'press' } });
      }
      if (input.type !== 'tick') return same(state);
      const bar = tickCatchBar(state.bar, input.dtMs, state.bar.holding, state.fish, ctx.barGear, ctx.rng);
      const result = barResult(bar);
      const { zone, fish, distanceM, hooked } = state;
      if (result === 'caught') {
        return {
          state: { kind: 'caught', distanceM, zone, hooked, fish, shownMs: 0 },
          events: [
            {
              type: 'fishCaught',
              zone,
              pattern: fish.pattern,
              difficulty: fish.difficulty,
              fightMs: bar.elapsedMs,
              speciesId: hooked.speciesId,
              lengthCm: hooked.lengthCm,
              weightG: hooked.weightG,
            },
          ],
        };
      }
      if (result === 'lost') {
        return {
          state: { kind: 'lost', distanceM, ageMs: 0 },
          events: [{ type: 'fishLost', zone, pattern: fish.pattern, difficulty: fish.difficulty, speciesId: hooked.speciesId }],
        };
      }
      return same({ ...state, bar });
    }

    case 'caught': {
      if (input.type === 'press' && state.shownMs >= FIGHT_TUNING.showOffGuardMs) return same(INITIAL_STATE);
      if (input.type !== 'tick') return same(state);
      const shownMs = state.shownMs + input.dtMs;
      return same(shownMs >= (ctx.showOffMs ?? FIGHT_TUNING.showOffMs) ? INITIAL_STATE : { ...state, shownMs });
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

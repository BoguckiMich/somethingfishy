import { castDistance, chargePower, MIN_HOLD_MS } from './casting';
import type { CatchBarState, FishProfile } from './catchBar';
import type { TimeOfDay } from './clock';
import { speciesById } from './data/fish';
import type { GameEvent } from './events';
import { beginFight, holdFight, tickFight, type CatchStyle } from './fight';
import { advanceDrift, biteRate, driftGearMul, fightEveryMul, type RiverGearOwned } from './current';
import type { LineFightState } from './lineFight';
import { baitById } from './data/baits';
import type { WeatherEffects } from './daily/weather';
import { fightProfile, rollHookedFish, type HookedFish } from './fish';
import type { BarGear, Rod } from './gear';
import { poolAt, zoneAt, type Location, type ZoneId } from './location';
import type { Rng } from './random';
import { randInt, randRange } from './random';
import { SPIN_ROD } from './data/spinning';
import { newSpin, pressSpin, releaseSpin, snapFate, tickSpin, type SpinEnv, type SpinState } from './spinning';

/**
 * The float-fishing state machine. Pure: the scene sends events in and renders whatever
 * state comes out. Animations (cast arc, reel-in) are owned by the scene, which reports
 * their end with `landed` / `retrieved`. Randomness comes from the injected `rng`.
 */
export type FishingState =
  | { kind: 'idle' }
  | { kind: 'charging'; heldMs: number }
  /** `lure` (slice 32): a spinning cast, the lure id; absent = the float rig. */
  | { kind: 'casting'; power: number; distanceM: number; zone: ZoneId; lure?: string }
  /** Bobber in the water. `untilMs` counts down to the next nibble or the real bite. `drift` (slice 25c, moving water only: 0 landed .. 1 settled in the eddy) is carried through every state after, so the bobber stays where it is. */
  | { kind: 'waiting'; distanceM: number; zone: ZoneId; hooked: HookedFish; untilMs: number; nibblesLeft: number; hadNibble: boolean; drift?: number }
  /** The real bite: the bobber is under and the player must tap within `windowLeftMs`. */
  | { kind: 'bite'; distanceM: number; zone: ZoneId; hooked: HookedFish; windowLeftMs: number; drift?: number }
  /** The fight. Classic: holding raises the catch-bar zone; `bar.holding` mirrors the player's thumb. Line style (slice 28): `line` carries the fight and `bar` is an inert placeholder (core/fight.ts). */
  | { kind: 'fighting'; distanceM: number; zone: ZoneId; hooked: HookedFish; fish: FishProfile; bar: CatchBarState; line?: LineFightState; drift?: number; /** Hooked on this lure (slice 32). */ lure?: string }
  /** The show-off: the fish is held up. A press (after a short guard) or the timer ends it. */
  | { kind: 'caught'; distanceM: number; zone: ZoneId; hooked: HookedFish; fish: FishProfile; shownMs: number }
  /** The fish got away: the line hangs slack for a moment, then the normal reel-in follows. */
  | { kind: 'lost'; distanceM: number; ageMs: number; drift?: number }
  | { kind: 'retrieving'; distanceM: number; drift?: number }
  /** The spinning retrieve (slice 32, core/spinning.ts): the lure is in the water and the thumb reels (down) or pauses (up). `distanceM` and `zone` follow the lure. */
  | { kind: 'spinning'; distanceM: number; zone: ZoneId; spin: SpinState };

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
  /** How fast the river runs right now, 1 = normal weather (the scene's foam-streak speed: faster in rain, slower while the ferry rope creaks). Absent = 1. Only a place with a `current` reads it. */
  flow?: () => number;
  /** The river gear she owns (slice 25g: trotting float, heavy lead). Absent = none. Only a place with a `current` reads it. */
  riverGear?: () => RiverGearOwned;
  /** Which rig she fishes with (slice 32): 'spin' casts a lure with the spinning rod (30 m, its own flex) and plays the retrieve; absent or 'float' = the float rig as ever. */
  rig?: () => 'float' | 'spin';
  /** The lure on the line (a lure id from data/spinning.ts); a spin cast needs one (no lure = a float cast). */
  lureId?: () => string | undefined;
  /** Today's weather and what it does to the bites right now (slice 23b). Absent means none. */
  weatherFx?: () => WeatherEffects | undefined;
  /** The current time of day, from the scene's clock (core stays free of the clock itself). */
  timeOfDay: () => TimeOfDay;
  /** The in-game minute of the day; the legendary's clock window needs it. Absent means no legendary. */
  minute?: () => number;
  /** Which fight a hooked fish gets (asked when the fight starts, so switching mid-fight changes nothing). Absent means classic. */
  catchStyle?: () => CatchStyle;
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

/** The rod's catch-bar values with the bait on the hook on top (balance A2: corn calms the fish, `Bait.calm`); worms or none change nothing. */
export function fightGear(gear: BarGear, baitId: string | undefined): BarGear {
  const calm = baitById(baitId)?.calm ?? 0;
  return calm > gear.baitCalm ? { ...gear, baitCalm: calm } : gear;
}

/** The drift of a state, as a spread for the next state (nothing at still water, so Quiet Lake's states are what they always were). */
const driftOf = (state: { drift?: number }): { drift?: number } => (state.drift !== undefined ? { drift: state.drift } : {});

/** Is this a spin cast (slice 32)? The rig must be spin AND a lure chosen; the id of the lure, or undefined for a float cast. */
const spinLure = (ctx: SessionContext): string | undefined => (ctx.rig?.() === 'spin' ? ctx.lureId?.() : undefined);

/** The rod's catch-bar values on the spinning rod: its zone and core on top of the equipped line and reel (the rods share everything else). */
export function spinBarGear(gear: BarGear): BarGear {
  return { ...gear, zoneSize: SPIN_ROD.barGear.zoneSize, ...(SPIN_ROD.barGear.coreShare !== undefined ? { coreShare: SPIN_ROD.barGear.coreShare } : {}) };
}

const spinEnv = (ctx: SessionContext): SpinEnv => ({ location: ctx.location, time: ctx.timeOfDay(), minute: ctx.minute?.(), fx: ctx.weatherFx?.(), fotdId: ctx.fotdId?.(), flow: ctx.flow?.() ?? 1 });

/** The session's view of a spin step: the state to continue with and the events, or the fight a hooked strike starts. */
function spinResult(state: Extract<FishingState, { kind: 'spinning' }>, r: ReturnType<typeof tickSpin>, ctx: SessionContext): StepResult {
  const { spin, events, outcome } = r;
  const zone = zoneAt(ctx.location, spin.distanceM).fishZone;
  if (outcome.kind === 'out') return { state: INITIAL_STATE, events };
  if (outcome.kind === 'snag') return { state: { kind: 'retrieving', distanceM: spin.distanceM, ...(spin.drift !== undefined ? { drift: spin.drift } : {}) }, events };
  if (outcome.kind === 'hooked') {
    const hooked = outcome.hooked;
    const fish = ctx.fishOverride ?? fightProfile(speciesById(hooked.speciesId)!, hooked.lengthCm, ctx.weatherFx?.()?.difficultyAdd);
    const fight = beginFight(ctx.catchStyle?.() ?? 'classic', fish, spinBarGear(ctx.barGear), ctx.rng, spin.distanceM, hooked.speciesId, fightEveryMul(ctx.location.current, ctx.weatherFx?.()?.id === 'rain', fish.slipAfterMs !== undefined));
    return {
      state: { kind: 'fighting', distanceM: spin.distanceM, zone, hooked, fish, ...fight, lure: spin.lure, ...(spin.drift !== undefined ? { drift: spin.drift } : {}) },
      events: [...events, { type: 'hooked', zone, lure: spin.lure }],
    };
  }
  return { state: { ...state, distanceM: spin.distanceM, zone, spin }, events };
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
        const lure = spinLure(ctx);
        const distanceM = castDistance(power, lure ? SPIN_ROD : ctx.rod);
        const zone = zoneAt(ctx.location, distanceM).fishZone;
        return {
          state: { kind: 'casting', power, distanceM, zone, ...(lure ? { lure } : {}) },
          events: [{ type: 'cast', distanceM, zone, locationId: ctx.location.id, ...(lure ? { lure } : {}) }],
        };
      }
      return same(state);

    case 'casting':
      if (input.type !== 'landed') return same(state);
      // A lure (slice 32): the retrieve begins, no fish is rolled until a predator follows.
      if (state.lure) return same({ kind: 'spinning', distanceM: state.distanceM, zone: state.zone, spin: newSpin(state.lure, state.distanceM, ctx.location) });
      // The fish is chosen as the bobber lands: its species shapes the wait (shy fish nibble more).
      const bait = ctx.baitId?.();
      const fx = ctx.weatherFx?.();
      const hooked = rollHookedFish(
        state.zone,
        ctx.timeOfDay(),
        ctx.rng,
        ctx.speciesOverride,
        ctx.minute ? { placeId: ctx.location.id, bandId: zoneAt(ctx.location, state.distanceM).id, distanceM: state.distanceM, minute: ctx.minute() } : undefined,
        bait,
        ctx.fotdId?.(),
        fx,
        poolAt(ctx.location, state.distanceM),
      );
      return same({
        kind: 'waiting',
        distanceM: state.distanceM,
        zone: state.zone,
        hooked,
        untilMs: randRange(ctx.rng, ...BITE_TUNING.firstWaitMs) * firstWaitFactor(bait, state.zone) * (fx?.waitFactor ?? 1) * (fx?.zoneWaitFactor[state.zone] ?? 1),
        nibblesLeft: randInt(ctx.rng, ...speciesById(hooked.speciesId)!.nibbles),
        hadNibble: false,
        ...(ctx.location.current ? { drift: 0 } : {}),
      });

    case 'waiting': {
      if (input.type === 'press') {
        // Reeling in before the bite. If a fish was already nibbling, it gets scared off.
        return {
          state: { kind: 'retrieving', distanceM: state.distanceM, ...driftOf(state) },
          events: state.hadNibble ? [{ type: 'fishEscaped', reason: 'tooEarly' }] : [],
        };
      }
      if (input.type !== 'tick') return same(state);
      // Moving water (slice 25c): the bobber drifts and the countdown runs at the river's rate; nothing is re-rolled.
      const cur = ctx.location.current;
      const bandId = cur ? zoneAt(ctx.location, state.distanceM).id : '';
      const gear = cur ? ctx.riverGear?.() : undefined;
      const drift = cur && state.drift !== undefined ? advanceDrift(state.drift, input.dtMs, ctx.flow?.() ?? 1, cur, driftGearMul(gear, bandId)) : state.drift;
      const rate = cur ? biteRate(cur, bandId, state.drift, gear) : 1;
      const untilMs = state.untilMs - input.dtMs * rate;
      const settled = drift === 1 && state.drift !== undefined && state.drift < 1;
      const drifted = drift !== undefined ? { drift } : {};
      if (untilMs > 0) return { state: { ...state, untilMs, ...drifted }, events: settled ? [{ type: 'driftSettled' }] : [] };
      if (state.nibblesLeft > 0) {
        return {
          state: {
            ...state,
            untilMs: randRange(ctx.rng, ...BITE_TUNING.nibbleGapMs),
            nibblesLeft: state.nibblesLeft - 1,
            hadNibble: true,
            ...drifted,
          },
          events: settled ? [{ type: 'nibble' }, { type: 'driftSettled' }] : [{ type: 'nibble' }],
        };
      }
      return {
        state: { kind: 'bite', distanceM: state.distanceM, zone: state.zone, hooked: state.hooked, windowLeftMs: BITE_TUNING.hookWindowMs, ...drifted },
        events: settled ? [{ type: 'bite' }, { type: 'driftSettled' }] : [{ type: 'bite' }],
      };
    }

    case 'bite': {
      if (input.type === 'press') {
        const fish = ctx.fishOverride ?? fightProfile(speciesById(state.hooked.speciesId)!, state.hooked.lengthCm, ctx.weatherFx?.()?.difficultyAdd);
        const fight = beginFight(ctx.catchStyle?.() ?? 'classic', fish, fightGear(ctx.barGear, ctx.baitId?.()), ctx.rng, state.distanceM, state.hooked.speciesId, fightEveryMul(ctx.location.current, ctx.weatherFx?.()?.id === 'rain', fish.slipAfterMs !== undefined));
        return {
          state: { kind: 'fighting', distanceM: state.distanceM, zone: state.zone, hooked: state.hooked, fish, ...fight, ...driftOf(state) },
          events: [{ type: 'hooked', zone: state.zone }],
        };
      }
      if (input.type !== 'tick') return same(state);
      const windowLeftMs = state.windowLeftMs - input.dtMs;
      if (windowLeftMs > 0) return same({ ...state, windowLeftMs });
      return {
        state: { kind: 'retrieving', distanceM: state.distanceM, ...driftOf(state) },
        events: [{ type: 'fishEscaped', reason: 'tooLate' }],
      };
    }

    case 'fighting': {
      if (input.type === 'press' || input.type === 'release' || input.type === 'cancel') {
        return same({ ...state, ...holdFight(state, input.type === 'press') });
      }
      if (input.type !== 'tick') return same(state);
      const { fight, outcome } = tickFight(state, input.dtMs, state.fish, fightGear(ctx.barGear, ctx.baitId?.()), ctx.rng);
      const { zone, fish, distanceM, hooked } = state;
      if (outcome.kind === 'caught') {
        return {
          state: { kind: 'caught', distanceM, zone, hooked, fish, shownMs: 0 },
          events: [
            {
              type: 'fishCaught',
              zone,
              pattern: fish.pattern,
              difficulty: fish.difficulty,
              fightMs: outcome.fightMs,
              speciesId: hooked.speciesId,
              lengthCm: hooked.lengthCm,
              weightG: hooked.weightG,
              ...(outcome.perfect ? { perfect: true } : {}),
              ...(state.lure ? { lure: state.lure } : {}),
            },
          ],
        };
      }
      if (outcome.kind === 'lost') {
        return {
          state: { kind: 'lost', distanceM, ageMs: 0, ...driftOf(state) },
          events: [
            {
              type: 'fishLost',
              zone,
              pattern: fish.pattern,
              difficulty: fish.difficulty,
              speciesId: hooked.speciesId,
              ...(outcome.slipped ? { slipped: true } : {}),
              ...(outcome.snapped ? { snapped: true } : {}),
              ...(state.lure ? { lure: state.lure } : {}),
            },
            // A snapped line may take the lure with it (slice 32); a slip or any other escape keeps it.
            ...(state.lure && outcome.snapped ? [snapFate(state.lure, ctx.rng)] : []),
          ],
        };
      }
      return same({ ...state, ...fight });
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
      return same(ageMs >= FIGHT_TUNING.slackMs ? { kind: 'retrieving', distanceM: state.distanceM, ...driftOf(state) } : { ...state, ageMs });
    }

    case 'spinning': {
      const env = spinEnv(ctx);
      if (input.type === 'press') return spinResult(state, pressSpin(state.spin, env, ctx.rng), ctx);
      if (input.type === 'release' || input.type === 'cancel') return same({ ...state, spin: releaseSpin(state.spin) });
      if (input.type !== 'tick') return same(state);
      return spinResult(state, tickSpin(state.spin, input.dtMs, env, ctx.rng), ctx);
    }

    case 'retrieving':
      return input.type === 'retrieved' ? same(INITIAL_STATE) : same(state);
  }
}

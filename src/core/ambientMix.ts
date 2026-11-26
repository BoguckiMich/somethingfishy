import type { WeatherId } from './data/weather';

/**
 * Which ambient layers are audible at a time of day (pure). Mirrors the `dayLook` keyframes in
 * src/art/dayCycle.ts: the sun-up day runs 06:00 to 17:30, dusk 17:30 to 20:30, night after that.
 * Layers crossfade with smoothstep ramps so there are no jumps.
 */
export interface AmbientMix {
  /** Always on. */
  water: number;
  /** By day (a dawn chorus from 05:00, gone by 19:30). */
  birds: number;
  /** At dusk (17:30 to 22:30, loudest around 19:30 to 20:30). */
  frogs: number;
  /** At night (20:00 to 05:30). */
  crickets: number;
}

const DAY = 24 * 60;
const hm = (h: number, m = 0) => h * 60 + m;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * 0 before `rise`, up to 1 at `full`, 1 until `fall`, down to 0 at `gone`. The four times
 * ascend and may run past midnight (`gone` can exceed 24:00); `minute` is wrapped around them.
 */
function trapezoid(minute: number, rise: number, full: number, fall: number, gone: number): number {
  const r = (((minute - rise) % DAY) + DAY) % DAY;
  if (r < full - rise) return smooth(r / (full - rise));
  if (r < fall - rise) return 1;
  if (r < gone - rise) return 1 - smooth((r - (fall - rise)) / (gone - fall));
  return 0;
}

export function ambientMix(minute: number): AmbientMix {
  return {
    water: 1,
    birds: trapezoid(minute, hm(5), hm(7), hm(17, 30), hm(19, 30)),
    frogs: trapezoid(minute, hm(17, 30), hm(19, 30), hm(20, 30), hm(22, 30)),
    crickets: trapezoid(minute, hm(20), hm(22), hm(28), hm(29, 30)),
  };
}

// ---- Weather and campfire beds (slice 27) ---------------------------------------------------

/** The layers that follow the weather and the camp rather than the clock alone. */
export interface WeatherMix {
  /** Rain on the water and the leaves (with soft droplets). */
  rain: number;
  /** A slow breeze in the reeds. */
  wind: number;
  /** The campfire's crackle. */
  fire: number;
}

/** The mix when nothing of the weather or camp sounds (the Pale One's fight). */
export const NO_WEATHER_MIX: WeatherMix = { rain: 0, wind: 0, fire: 0 };

/** How much of the wind layer each weather has: a full bed when windy, a hint of breeze under rain and grey skies. */
const WIND_LEVEL: Partial<Record<WeatherId, number>> = { windy: 1, rain: 0.25, overcast: 0.18 };
/** The fire crackles quieter in the rain (the logs are damp). */
const FIRE_RAIN = 0.55;

/**
 * The weather and campfire layers for a time of day (pure). Rain only when it rains, wind by the table above, the campfire only when it
 * is owned and it is dusk or night (from 17:30, full by 20:00, until 05:00 and gone by 06:00). `weather` undefined (not decided yet) is
 * calm. `birdDuck` is the factor the weather puts on the birds: rain and wind quiet them.
 */
export function weatherMix(weather: WeatherId | undefined, minute: number, ownsFire: boolean): WeatherMix & { birdDuck: number } {
  const night = trapezoid(minute, hm(17, 30), hm(20), hm(29), hm(30));
  const rain = weather === 'rain' ? 1 : 0;
  const wind = (weather && WIND_LEVEL[weather]) || 0;
  return {
    rain,
    wind,
    fire: ownsFire ? night * (rain > 0 ? FIRE_RAIN : 1) : 0,
    birdDuck: weather === 'rain' ? 0.3 : weather === 'windy' ? 0.6 : 1,
  };
}

// ---- The river's current (M2 groundwork B) ----------------------------------------------------

/** The river bed: the current's own level, and how far the lake's soft lapping is ducked (the current takes its place). */
export interface RiverMix {
  /** Water running over gravel: a band-passed hush with a slow swell (a different character from the rain's hiss). */
  current: number;
  /** Factor on the lake's `water` layer. */
  waterDuck: number;
}

/** The mix at a place whose water does not run (Quiet Lake). */
export const NO_RIVER_MIX: RiverMix = { current: 0, waterDuck: 1 };

/** How full the current runs in each weather: rain swells the river (high water), grey skies a little; otherwise a steady 0.75. */
const CURRENT_LEVEL: Partial<Record<WeatherId, number>> = { rain: 1, overcast: 0.82 };
const CURRENT_BASE = 0.75;
/** The lake lapping is mostly replaced at the river (a hint stays: the lap on the landing). */
const RIVER_WATER_DUCK = 0.35;

/** The river's layers for a place and today's weather (pure): silent and no ducking away from a river. `weather` undefined (not decided yet) is the steady level. */
export function riverMix(river: boolean, weather: WeatherId | undefined): RiverMix {
  if (!river) return NO_RIVER_MIX;
  return { current: (weather && CURRENT_LEVEL[weather]) || CURRENT_BASE, waterDuck: RIVER_WATER_DUCK };
}

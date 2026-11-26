import type { ZoneId } from '../location';
import type { Rarity } from './fish';

/** The daily weather (slice 23b): one of five conditions, picked by the real date. */
export type WeatherId = 'sunny' | 'overcast' | 'rain' | 'windy' | 'fog';

export const WEATHER_IDS: readonly WeatherId[] = ['sunny', 'overcast', 'rain', 'windy', 'fog'];

export const WEATHER_NAMES: Record<WeatherId, string> = {
  sunny: 'Sunny & calm',
  overcast: 'Overcast',
  rain: 'Light rain',
  windy: 'Windy',
  fog: 'Morning fog',
};

/** The word the log card uses ("Likes: rain"). */
export const WEATHER_WORDS: Record<WeatherId, string> = { sunny: 'sun', overcast: 'overcast', rain: 'rain', windy: 'wind', fog: 'fog' };

/**
 * What each weather does to the bites. Tunable data. Which species LIKE a weather lives on the species
 * (`Species.likes`), so new species only need a `likes` list.
 */
export interface WeatherTuning {
  /**
   * Multiplier on the wait before the first nibble, per zone of the cast (sunny: shallow bites come sooner, deep ones later).
   * A per-zone WEIGHT would do nothing: a cast already picks among the species of its own zone, so a uniform factor cancels
   * (balance A2: that was the old "sunny" and it changed no bite at all).
   */
  zoneWaitFactor?: Partial<Record<ZoneId, number>>;
  /** Species that like this weather get this weight multiplier (rain, windy). */
  likedWeight?: number;
  /** Species that like this weather may bite at any time of day, at their normal weight (overcast). */
  likedAnyTime?: boolean;
  /** Weight multiplier per rarity (fog). It holds the whole hour the weather is on, and so does the fog you see (`WEATHER_LOOK.fogFloor`). */
  rarityWeight?: Partial<Record<Rarity, number>>;
  /** Multiplier on the wait before the first nibble (rain: faster bites). */
  waitFactor?: number;
  /** Added to the fight difficulty, the total capped at 1 (windy). */
  difficultyAdd?: number;
}

export const WEATHER_TUNING: Record<WeatherId, WeatherTuning> = {
  sunny: { zoneWaitFactor: { shallow: 0.8, deep: 1.25 } },
  overcast: { likedAnyTime: true },
  rain: { waitFactor: 0.75, likedWeight: 1.5 },
  windy: { likedWeight: 1.5, difficultyAdd: 0.05 },
  fog: { rarityWeight: { rare: 2 } },
};

/** Visual tunables (the scene only): how grey the sky and water go, and when the fog starts to thin. */
export const WEATHER_LOOK = {
  grey: { sunny: 0, overcast: 0.7, rain: 0.65, windy: 0.1, fog: 0.3 } as Record<WeatherId, number>,
  /** The fog is full until this minute, then thins to `fogFloor` by `fogThinToMinute`. */
  fogThinFromMinute: 8 * 60 + 30,
  fogThinToMinute: 10 * 60,
  /** The fog never thins below this (0..1) for as long as the weather is fog, so what you see is what the rare fish and Old Mossback need. */
  fogFloor: 0.6,
};

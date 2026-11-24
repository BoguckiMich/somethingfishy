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
  /** Weight multiplier per zone (sunny: shallow up, deep down). */
  zoneWeight?: Partial<Record<ZoneId, number>>;
  /** Species that like this weather get this weight multiplier (rain, windy). */
  likedWeight?: number;
  /** Species that like this weather may bite at any time of day, at their normal weight (overcast). */
  likedAnyTime?: boolean;
  /** Weight multiplier per rarity, only before `untilMinute` (fog). */
  rarityWeight?: Partial<Record<Rarity, number>>;
  /** The effect (and the visible fog) ends at this minute of the day. */
  untilMinute?: number;
  /** Multiplier on the wait before the first nibble (rain: faster bites). */
  waitFactor?: number;
  /** Added to the fight difficulty, the total capped at 1 (windy). */
  difficultyAdd?: number;
}

export const WEATHER_TUNING: Record<WeatherId, WeatherTuning> = {
  sunny: { zoneWeight: { shallow: 1.4, deep: 0.75 } },
  overcast: { likedAnyTime: true },
  rain: { waitFactor: 0.75, likedWeight: 1.5 },
  windy: { likedWeight: 1.5, difficultyAdd: 0.05 },
  fog: { rarityWeight: { rare: 2 }, untilMinute: 10 * 60 },
};

/** Visual tunables (the scene only): how grey the sky and water go, and when the fog starts to thin. */
export const WEATHER_LOOK = {
  grey: { sunny: 0, overcast: 0.7, rain: 0.65, windy: 0.1, fog: 0.3 } as Record<WeatherId, number>,
  /** The fog is full until this minute and gone at `untilMinute`. */
  fogThinFromMinute: 8 * 60 + 30,
};

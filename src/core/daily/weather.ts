import { WEATHER_IDS, WEATHER_TUNING, type WeatherId } from '../data/weather';
import { WEATHER_LOOK } from '../data/weather';
import type { Rarity, Species } from '../data/fish';
import type { ZoneId } from '../location';
import { hashString } from '../quests/quests';
import { isValidDate } from './dates';

/**
 * The daily weather (slice 23b). Pure: seeded from the real date only, like `fishOfTheDay`, so the same
 * day always has the same weather and nothing is saved. An invalid date has none.
 */
export function weatherOfTheDay(today: string): WeatherId | undefined {
  if (!isValidDate(today)) return undefined;
  return WEATHER_IDS[hashString(`weather:${today}`) % WEATHER_IDS.length];
}

/** What a weather does to the bites right now, flattened for the core rules (fog already knows the clock). */
export interface WeatherEffects {
  id: WeatherId;
  zoneWeight: Partial<Record<ZoneId, number>>;
  likedWeight: number;
  likedAnyTime: boolean;
  rarityWeight: Partial<Record<Rarity, number>>;
  waitFactor: number;
  difficultyAdd: number;
}

/** The effects of `id` at `minute` of the in-game day; the fog rule switches off at 10:00. */
export function weatherEffects(id: WeatherId, minute: number): WeatherEffects {
  const t = WEATHER_TUNING[id];
  const active = t.untilMinute === undefined || minute < t.untilMinute;
  return {
    id,
    zoneWeight: t.zoneWeight ?? {},
    likedWeight: t.likedWeight ?? 1,
    likedAnyTime: t.likedAnyTime ?? false,
    rarityWeight: active ? (t.rarityWeight ?? {}) : {},
    waitFactor: t.waitFactor ?? 1,
    difficultyAdd: t.difficultyAdd ?? 0,
  };
}

/** True when the species likes this weather. */
export const likesWeather = (species: Species, id: WeatherId): boolean => species.likes?.includes(id) ?? false;

/** The weight multiplier the weather puts on one species (1 = no change). */
export function weatherWeightMult(species: Species, fx?: WeatherEffects): number {
  if (!fx) return 1;
  let m = fx.zoneWeight[species.zone] ?? 1;
  m *= fx.rarityWeight[species.rarity] ?? 1;
  if (likesWeather(species, fx.id)) m *= fx.likedWeight;
  return m;
}

/** True when the weather lets the species bite whatever the time of day. */
export const weatherAllowsAnyTime = (species: Species, fx?: WeatherEffects): boolean => !!fx && fx.likedAnyTime && likesWeather(species, fx.id);

/** 1 while the fog is full, fading to 0 at 10:00 (the look only; the bite rule is a hard cut at 10:00). */
export function fogStrength(minute: number): number {
  const end = WEATHER_TUNING.fog.untilMinute ?? 600;
  const from = WEATHER_LOOK.fogThinFromMinute;
  if (minute >= end) return 0;
  return minute <= from ? 1 : (end - minute) / (end - from);
}

// ---- Pajkel's line on the day's first visit ----

/** True when today's weather line was not said yet (`seen` is the stored date). */
export const weatherLineDue = (seen: string | undefined, today: string): boolean => isValidDate(today) && seen !== today;

/** Anything saved -> a valid date or nothing. */
export const normalizeWeatherSeen = (v: unknown): string | undefined => (isValidDate(v) ? v : undefined);

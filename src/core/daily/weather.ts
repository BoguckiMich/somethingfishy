import { WEATHER_IDS, WEATHER_TUNING, type WeatherId } from '../data/weather';
import { WEATHER_LOOK } from '../data/weather';
import type { Rarity, Species } from '../data/fish';
import type { ZoneId } from '../location';
import { hashString } from '../quests/quests';
import { isValidDate } from './dates';

/** Weight of the previous hour's weather in the next pick (the others weigh 1): repeats are rare, not banned. */
export const WEATHER_REPEAT_WEIGHT = 1 / 3;

/** A real hour as `YYYY-MM-DD-HH` (the key the weather and Pajkel's line follow); undefined when not valid. */
export function weatherHourKey(date: string, hour: number): string | undefined {
  return isValidDate(date) && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? `${date}-${String(hour).padStart(2, '0')}` : undefined;
}

/** Picks the next weather after `prev` (undefined = a plain pick), weighted so `prev` counts for a third. */
function pickWeather(seed: string, prev: WeatherId | undefined): WeatherId {
  const w = WEATHER_IDS.map((id) => (id === prev ? WEATHER_REPEAT_WEIGHT : 1));
  const total = w.reduce((a, b) => a + b, 0);
  // FNV alone is weak on seeds that differ in their last characters, so mix its bits (murmur3 finaliser) before use.
  let h = hashString(seed);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  let r = ((h >>> 0) / 0x100000000) * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r < 0) return WEATHER_IDS[i];
  }
  return WEATHER_IDS[WEATHER_IDS.length - 1];
}

/**
 * The weather of one real hour (weather changes every real hour, decided 2026-11-24; one real hour = 3 in-game
 * days). Pure and seeded from the real date + hour, like `fishOfTheDay`: the same hour always has the same
 * weather and nothing is saved. Each date's chain starts with a plain pick at 00:00 and every later hour is
 * picked from the one before it (at most 24 steps), so a repeat is about a third as likely as under a uniform pick.
 * An invalid date or hour has none.
 */
export function weatherForHour(date: string, hour: number): WeatherId | undefined {
  if (!weatherHourKey(date, hour)) return undefined;
  let w = pickWeather(`weather:${date}:0`, undefined);
  for (let h = 1; h <= hour; h++) w = pickWeather(`weather:${date}:${h}`, w);
  return w;
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

// ---- Pajkel's line, once per weather change ----

/** True when the line for this real hour was not said yet (`seen` is the stored hour key). */
export const weatherLineDue = (seen: string | undefined, key: string | undefined): boolean => !!key && seen !== key;

/** Anything saved -> a valid `YYYY-MM-DD-HH` key or nothing; an old plain date (the daily-weather days) becomes its hour 00. */
export function normalizeWeatherSeen(v: unknown): string | undefined {
  if (isValidDate(v)) return `${v}-00`;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(v)) return undefined;
  return weatherHourKey(v.slice(0, 10), Number(v.slice(11))) ;
}

/** True when a new hour's weather may come in: Alex is idle or waiting and nothing (a panel, the name card, the sleep fade) is up. */
export const weatherFlipAllowed = (fishingKind: string, uiBusy: boolean): boolean => !uiBusy && (fishingKind === 'idle' || fishingKind === 'waiting');

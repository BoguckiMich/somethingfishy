import { timeOfDay } from './clock';
import { LAKE_ID, RARE_RULES, RARE_TUNING, RIVER_ID, TROPHY_IDS, trophyIdsAt, type RareRule } from './data/rare';
import { speciesById, type Species } from './data/fish';
import { tierFor } from './data/stars';
import { isValidDate } from './daily/dates';
import type { WeatherId } from './data/weather';
import type { HookedFish } from './fish';
import type { ZoneId } from './location';
import type { Rng } from './random';

/**
 * Rules for the three rare trophy fish (slice 23d, pure). Like the Pale One they are not in the weighted pool: a landed cast whose
 * place, clock, weather and bait fit a rule's conditions replaces the normal pick with `RARE_TUNING.chance`.
 */

/** What the rule needs to know about a landed cast. */
export interface RareCast {
  /** The place's id; missing = Quiet Lake (the rules of slice 23d knew only one place). */
  placeId?: string;
  /** The id of the band the bobber landed in (the river's 'riffle', 'seam' or 'pool'); only the river's rules read it. */
  bandId?: string;
  zone: ZoneId;
  distanceM: number;
  /** Minute of the in-game day. */
  minute: number;
  /** Today's weather id (the whole day, fog included); none = no weather known, so no rare fish. */
  weather?: WeatherId;
  /** The bait on the hook; undefined or 'worm' is the plain worm. */
  baitId?: string;
}

const MINUTES_PER_DAY = 24 * 60;

/** Do ALL of the rule's conditions hold for this cast? Each condition missing means no spawn. */
export function ruleMet(rule: RareRule, c: RareCast): boolean {
  if ((c.placeId ?? LAKE_ID) !== rule.placeId) return false;
  if (rule.bandId && c.bandId !== rule.bandId) return false;
  if (!c.weather || c.weather !== rule.weather) return false;
  const minute = ((c.minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (rule.times && !rule.times.includes(timeOfDay(minute))) return false;
  if (rule.hours && !(minute >= rule.hours.from * 60 && minute < rule.hours.to * 60)) return false;
  if (rule.zone && c.zone !== rule.zone) return false;
  if (rule.baitId && c.baitId !== rule.baitId) return false;
  if (rule.minDistanceM !== undefined && c.distanceM < rule.minDistanceM) return false;
  if (rule.maxDistanceM !== undefined && c.distanceM >= rule.maxDistanceM) return false;
  return true;
}

/** Can this trophy bite for this cast? */
export function rareCanSpawn(speciesId: string, c: RareCast): boolean {
  const rule = RARE_RULES.find((r) => r.speciesId === speciesId);
  return !!rule && ruleMet(rule, c);
}

/**
 * Rolls the replacement for a landed cast: the first trophy whose conditions all hold, with its chance, otherwise undefined.
 * The rng is only drawn when a rule is met, so every other cast rolls exactly as before.
 */
export function rollRare(c: RareCast, rng: Rng): Species | undefined {
  for (const rule of RARE_RULES) {
    if (ruleMet(rule, c)) return rng() < RARE_TUNING.chance ? speciesById(rule.speciesId) : undefined;
  }
  return undefined;
}

// ---- The trophy board ----

/** The biggest one caught of a trophy, and the real date it was caught. */
export interface Trophy {
  lengthCm: number;
  weightG: number;
  /** YYYY-MM-DD, or '' when the date was not known. */
  date: string;
  /** A perfect catch of a gold-size one (slice 23f): the card shows a medal. Stored only when true; sticky once earned. */
  medal?: true;
}
export type TrophyState = Record<string, Trophy>;

/**
 * Records a catch on the board. The first one is `first`; a later one only replaces it when it is longer (`improved`),
 * otherwise the board is unchanged, except that a perfect gold-size catch still adds the medal. `changed` is true
 * whenever the returned trophies differ from the input (save when it is).
 */
export function addTrophy(state: TrophyState | undefined, hooked: HookedFish, date: string, perfect = false): { trophies: TrophyState; first: boolean; improved: boolean; changed: boolean } {
  const cur = state ?? {};
  const old = cur[hooked.speciesId];
  const sp = speciesById(hooked.speciesId);
  const medal = old?.medal === true || (!!sp && tierFor(sp, hooked.lengthCm, perfect) === 'medal');
  if (old && hooked.lengthCm <= old.lengthCm) {
    // Not a bigger one, but a perfect gold-size catch still earns the medal.
    if (medal && !old.medal) return { trophies: { ...cur, [hooked.speciesId]: { ...old, medal: true } }, first: false, improved: false, changed: true };
    return { trophies: cur, first: false, improved: false, changed: false };
  }
  const entry: Trophy = { lengthCm: hooked.lengthCm, weightG: hooked.weightG, date: isValidDate(date) ? date : '', ...(medal ? { medal: true as const } : {}) };
  return { trophies: { ...cur, [hooked.speciesId]: entry }, first: !old, improved: !!old, changed: true };
}

/** Anything saved -> a clean board: only known trophy ids, sane sizes, a valid date or ''. */
export function normalizeTrophies(v: unknown): TrophyState {
  const out: TrophyState = {};
  if (typeof v !== 'object' || v === null) return out;
  for (const id of TROPHY_IDS) {
    const e = (v as Record<string, unknown>)[id];
    if (typeof e !== 'object' || e === null) continue;
    const { lengthCm, weightG, date } = e as Record<string, unknown>;
    if (typeof lengthCm !== 'number' || !Number.isFinite(lengthCm) || lengthCm < 1 || lengthCm > 1000) continue;
    if (typeof weightG !== 'number' || !Number.isFinite(weightG) || weightG < 0) continue;
    out[id] = { lengthCm: Math.round(lengthCm), weightG: Math.round(weightG), date: isValidDate(date) ? date : '', ...((e as Record<string, unknown>).medal === true ? { medal: true as const } : {}) };
  }
  return out;
}

/** The legendary of each place: it is on that place's board once it is in the log. */
export const BOARD_LEGENDARY: Record<string, string> = { [LAKE_ID]: 'pale', [RIVER_ID]: 'ferryman' };

/** The ids that are on a place's board (default Quiet Lake): its caught trophies (in board order), then its legendary when it is in the log. */
export function boardIds(trophies: TrophyState | undefined, log: Record<string, unknown>, placeId: string = LAKE_ID): string[] {
  const ids = trophyIdsAt(placeId).filter((id) => !!trophies?.[id]);
  const legend = BOARD_LEGENDARY[placeId];
  return legend && log[legend] ? [...ids, legend] : ids;
}

/** Does a place's board show at all? Only once one of ITS trophies is mounted (the legendary alone does not bring the board). */
export const boardShows = (trophies: TrophyState | undefined, placeId: string): boolean => trophyIdsAt(placeId).some((id) => !!trophies?.[id]);

/** Fills the board with a plausible catch of every trophy (dev flag ?trophies=all). */
export function fullBoard(date: string): TrophyState {
  const out: TrophyState = {};
  for (const id of TROPHY_IDS) {
    const sp = speciesById(id)!;
    const lengthCm = Math.round((sp.lengthCm[0] + sp.lengthCm[1]) / 2);
    out[id] = { lengthCm, weightG: Math.round(sp.bodyFactor * lengthCm ** 3), date };
  }
  return out;
}

/** The trophy hints of a place (default Quiet Lake) not yet caught, in board order: the notice board's rumours. */
export function unknownHints(log: Record<string, unknown>, placeId: string = LAKE_ID): { id: string; text: string }[] {
  return trophyIdsAt(placeId).filter((id) => !log[id]).map((id) => ({ id, text: speciesById(id)?.logHint ?? '' }));
}

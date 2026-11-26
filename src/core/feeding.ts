import { isValidDate } from './daily/dates';
import type { PlayerState } from './inventory';

/**
 * Feeding Bestia (slice 30). Pure rules: no hunger and no stats, ever. A treat in the bowl is a small gift: the first feed of a
 * real day makes her next finished fetch round count as a stick round for the Stick Museum (the daily stick cap still applies),
 * and she eats at most `perDay` treats a day.
 */
export const FEED_TUNING = {
  /** She eats this many treats a real day; after that she is full. */
  perDay: 3,
  /** The most treats she can carry around (a hand-edited save cannot grow it). */
  maxTreats: 99,
};

export function normalizeTreats(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.min(FEED_TUNING.maxTreats, Math.floor(v)) : 0;
}

/** How many treats are in the bag. */
export const treatsOf = (p: PlayerState): number => normalizeTreats(p.treats);

/** Treats she ate on this real date (the count is only valid for the date it was kept on). */
export function fedToday(p: PlayerState, today: string): number {
  return p.fedDay === today && typeof p.fedDayN === 'number' && Number.isFinite(p.fedDayN) ? Math.max(0, Math.min(FEED_TUNING.perDay, Math.floor(p.fedDayN))) : 0;
}

/** Is the cozy bonus waiting: her next finished fetch round counts as a stick round. */
export const cozyPending = (p: PlayerState): boolean => p.cozy === true;

/** Can a treat go in the bowl today? */
export type FeedCheck = 'ok' | 'noTreats' | 'full';

export function checkFeed(p: PlayerState, today: string): FeedCheck {
  if (fedToday(p, today) >= FEED_TUNING.perDay) return 'full';
  if (treatsOf(p) <= 0) return 'noTreats';
  return 'ok';
}

export interface FeedResult {
  player: PlayerState;
  /** This was the first feed of the real day: the cozy bonus is on (Pajkel says his line). */
  bonus: boolean;
}

/** Adds treats to the bag (a shop pack); `n <= 0` changes nothing. */
export function addTreats(p: PlayerState, n: number): PlayerState {
  return n > 0 ? { ...p, treats: Math.min(FEED_TUNING.maxTreats, treatsOf(p) + Math.floor(n)) } : p;
}

/**
 * One treat is eaten: it leaves the bag, today's count goes up and the first of the day switches the cozy bonus on.
 * Returns null when `checkFeed` is not 'ok' (nothing changes). Never mutates.
 */
export function feedDog(p: PlayerState, today: string): FeedResult | null {
  if (checkFeed(p, today) !== 'ok' || !isValidDate(today)) return null;
  const n = fedToday(p, today);
  const treats = treatsOf(p) - 1;
  const next: PlayerState = { ...p, fedDay: today, fedDayN: n + 1, ...(n === 0 ? { cozy: true as const } : {}) };
  if (treats > 0) next.treats = treats;
  else delete next.treats;
  return { player: next, bonus: n === 0 };
}

/** The cozy bonus is used up (the round it was for has finished). */
export function spendCozy(p: PlayerState): PlayerState {
  if (!p.cozy) return p;
  const next = { ...p };
  delete next.cozy;
  return next;
}

/** Normalises the saved fields (each key only when there is something to keep). */
export function normalizeFeeding(p: Record<string, unknown>): Pick<PlayerState, 'treats' | 'fedDay' | 'fedDayN' | 'cozy'> {
  const treats = normalizeTreats(p.treats);
  const n = typeof p.fedDayN === 'number' && Number.isFinite(p.fedDayN) ? Math.floor(p.fedDayN) : 0;
  return {
    ...(treats > 0 ? { treats } : {}),
    ...(typeof p.fedDay === 'string' && isValidDate(p.fedDay) && n >= 1 ? { fedDay: p.fedDay, fedDayN: Math.min(FEED_TUNING.perDay, n) } : {}),
    ...(p.cozy === true ? { cozy: true as const } : {}),
  };
}

import { sticksAt, stickById, type StickDef } from './data/sticks';
import { isValidDate } from './daily/dates';
import { cozyPending, spendCozy } from './feeding';
import type { PlayerState } from './inventory';

/** The Stick Museum rules (slice 26): when a finished fetch round brings a new named stick. Pure. */
export const STICK_TUNING = {
  /** The first finished round brings one, then one every `every` rounds after it (rounds 1, 4, 7, ...). */
  every: 3,
  /** At most this many new sticks per real day. */
  perDay: 2,
};

/** The sticks she has, in the order they were found (unknown ids and duplicates dropped; older saves have none). */
export const sticksOf = (p: PlayerState): string[] => normalizeSticks(p.sticks);

export function normalizeSticks(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const id of v) if (typeof id === 'string' && stickById(id) && !out.includes(id)) out.push(id);
  return out;
}

/** Does this finished round (1 = the first ever) bring a stick, before the daily cap? */
export const isStickRound = (round: number): boolean => round >= 1 && (round - 1) % STICK_TUNING.every === 0;

/** The fetch rounds that ended, ever. */
export const fetchRoundsOf = (p: PlayerState): number => (typeof p.fetchRounds === 'number' && p.fetchRounds >= 0 ? Math.floor(p.fetchRounds) : 0);

/** How many new sticks were found on this real date. */
export function foundToday(p: PlayerState, today: string): number {
  return p.stickDay === today && typeof p.stickDayN === 'number' ? Math.max(0, Math.floor(p.stickDayN)) : 0;
}

/** The next stick of the place she has not found yet (data order), or null when the museum is full. */
export function nextStick(p: PlayerState, placeId: string): StickDef | null {
  const have = sticksOf(p);
  return sticksAt(placeId).find((s) => !have.includes(s.id)) ?? null;
}

export interface RoundResult {
  player: PlayerState;
  /** The stick found this round, or null. */
  found: StickDef | null;
}

/**
 * A fetch round has finished. Always counts the round; brings the next unfound stick of the place when it is a stick round
 * and fewer than `perDay` were found on `today`. Never mutates.
 */
export function finishFetchRound(p: PlayerState, placeId: string, today: string): RoundResult {
  const round = fetchRoundsOf(p) + 1;
  // The cozy bonus of a fed day (slice 30) makes this round a stick round too; it is used up by this round whatever comes of it.
  const cozy = cozyPending(p);
  const counted: PlayerState = { ...spendCozy(p), fetchRounds: round };
  if (!(isStickRound(round) || cozy) || foundToday(p, today) >= STICK_TUNING.perDay || !isValidDate(today)) return { player: counted, found: null };
  const found = nextStick(p, placeId);
  if (!found) return { player: counted, found: null };
  return {
    player: { ...counted, sticks: [...sticksOf(p), found.id], stickDay: today, stickDayN: foundToday(p, today) + 1 },
    found,
  };
}

/** Sticks she has found at a place, and how many it has: "3/10". */
export function museumCount(p: PlayerState, placeId: string): { found: number; total: number } {
  const here = sticksAt(placeId);
  const have = sticksOf(p);
  return { found: here.filter((s) => have.includes(s.id)).length, total: here.length };
}

/** The first `n` sticks of a place (dev flag ?sticks=all / ?sticks=N). */
export const firstSticks = (placeId: string, n = Infinity): string[] => sticksAt(placeId).slice(0, n).map((s) => s.id);

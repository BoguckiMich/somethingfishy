import { DAILY_BOX } from '../data/daily';
import type { PlayerState } from '../inventory';
import { randInt, type Rng } from '../random';
import { daysBetween, isValidDate } from './dates';

/**
 * The daily bait box. "Today" is the device's real local date, injected as `today` (YYYY-MM-DD);
 * nothing here reads a clock. The save keeps the last date a box was opened, so setting the
 * device clock back never grants a second box (setting it forward does, which is harmless).
 */
export interface DailyState {
  /** Date the last box was opened; null before the first one. */
  lastBoxDate: string | null;
  /** Streak tier of the last box (1..maxTier), 0 before the first one. */
  streakTier: number;
}

export const newDaily = (): DailyState => ({ lastBoxDate: null, streakTier: 0 });

export interface BoxContents {
  worms: number;
  coins: number;
  /** A lucky box: about three times everything. */
  lucky: boolean;
  /** The streak tier this box was filled at (also the "Day-in-a-row" number). */
  tier: number;
}

export const dailyOf = (p: PlayerState): DailyState => p.daily ?? newDaily();

/** True when no box was opened yet, or `today` is strictly later than the last opened date. */
export function boxAvailable(daily: DailyState, today: string): boolean {
  if (!isValidDate(today)) return false;
  if (daily.lastBoxDate === null || !isValidDate(daily.lastBoxDate)) return true;
  return daysBetween(daily.lastBoxDate, today) >= 1;
}

/**
 * The streak tier today's box is filled at. The new tier counts (a box opened the day after a
 * tier-2 box is a tier-3 box): first box ever 1; the next day +1 (max 5); a gap of two or more
 * days drops exactly one tier from the stored one (never below 1).
 */
export function tierFor(daily: DailyState, today: string): number {
  const stored = Math.min(DAILY_BOX.maxTier, Math.max(1, Math.floor(daily.streakTier) || 1));
  if (daily.lastBoxDate === null || !isValidDate(daily.lastBoxDate) || !isValidDate(today)) return 1;
  const gap = daysBetween(daily.lastBoxDate, today);
  if (gap <= 1) return Math.min(DAILY_BOX.maxTier, stored + 1);
  return Math.max(1, stored - 1);
}

/** x1 at tier 1, rising linearly to topTierMultiplier at the top tier. */
export function tierMultiplier(tier: number): number {
  const t = Math.min(DAILY_BOX.maxTier, Math.max(1, tier));
  return 1 + ((t - 1) / (DAILY_BOX.maxTier - 1)) * (DAILY_BOX.topTierMultiplier - 1);
}

/** Rolls what a box holds at this tier (integers; worms are at least 1). */
export function rollContents(tier: number, rng: Rng): BoxContents {
  const lucky = rng() < DAILY_BOX.luckyChance;
  const factor = tierMultiplier(tier) * (lucky ? DAILY_BOX.luckyMultiplier : 1);
  const baseWorms = randInt(rng, DAILY_BOX.worms.min, DAILY_BOX.worms.max);
  const hasCoins = rng() < DAILY_BOX.coins.chance;
  const baseCoins = randInt(rng, DAILY_BOX.coins.min, DAILY_BOX.coins.max);
  return {
    worms: Math.max(1, Math.round(baseWorms * factor)),
    coins: hasCoins ? Math.round(baseCoins * factor) : 0,
    lucky,
    tier,
  };
}

/**
 * Opens today's box: adds the worms and coins and records the date and tier. Returns
 * `contents: null` and the player untouched when there is no box to open (same day, or the
 * clock was set back).
 */
export function openBox(player: PlayerState, today: string, rng: Rng): { player: PlayerState; contents: BoxContents | null } {
  const daily = dailyOf(player);
  if (!boxAvailable(daily, today)) return { player, contents: null };
  const tier = tierFor(daily, today);
  const contents = rollContents(tier, rng);
  return {
    contents,
    player: {
      ...player,
      coins: player.coins + contents.coins,
      worms: player.worms + contents.worms,
      daily: { lastBoxDate: today, streakTier: tier },
    },
  };
}

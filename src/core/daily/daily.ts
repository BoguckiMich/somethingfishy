import { DAILY_BOX } from '../data/daily';
import { SHOP_BAITS } from '../data/baits';
import { addBait, type PlayerState } from '../inventory';
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
  /** Special baits in the box (slice 15c), by id: glow bait from tier 2 up, sometimes a shop bait. Missing in older code paths = none. */
  baits: Record<string, number>;
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

/** Chance of glow bait in a box at this tier: 0 below minTier, then linear from chanceAtMinTier to chanceAtMaxTier. */
export function glowChance(tier: number): number {
  const G = DAILY_BOX.glow;
  if (tier < G.minTier) return 0;
  const t = Math.min(1, (tier - G.minTier) / Math.max(1, DAILY_BOX.maxTier - G.minTier));
  return G.chanceAtMinTier + (G.chanceAtMaxTier - G.chanceAtMinTier) * t;
}

/** Rolls what a box holds at this tier (integers; worms are at least 1). */
export function rollContents(tier: number, rng: Rng): BoxContents {
  const lucky = rng() < DAILY_BOX.luckyChance;
  const factor = tierMultiplier(tier) * (lucky ? DAILY_BOX.luckyMultiplier : 1);
  const baseWorms = randInt(rng, DAILY_BOX.worms.min, DAILY_BOX.worms.max);
  const hasCoins = rng() < DAILY_BOX.coins.chance;
  const baseCoins = randInt(rng, DAILY_BOX.coins.min, DAILY_BOX.coins.max);
  // The bait rolls come last so the rolls above keep their order (and their seeded test values).
  const baits: Record<string, number> = {};
  if (rng() < glowChance(tier)) baits.glow = randInt(rng, DAILY_BOX.glow.min, DAILY_BOX.glow.max);
  if (rng() < DAILY_BOX.pack.chance) baits[SHOP_BAITS[randInt(rng, 0, SHOP_BAITS.length - 1)].id] = randInt(rng, DAILY_BOX.pack.min, DAILY_BOX.pack.max);
  return {
    worms: Math.max(1, Math.round(baseWorms * factor)),
    coins: hasCoins ? Math.round(baseCoins * factor) : 0,
    baits,
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
  let next: PlayerState = {
    ...player,
    coins: player.coins + contents.coins,
    worms: player.worms + contents.worms,
    daily: { lastBoxDate: today, streakTier: tier },
  };
  for (const [id, n] of Object.entries(contents.baits)) next = addBait(next, id, n);
  return { contents, player: next };
}

/** The line under the streak squares (slice 22b): what the next day in a row brings, or that the top tier is reached. */
export function tierHint(tier: number): string {
  if (tier >= DAILY_BOX.maxTier) return 'Top tier: the biggest box';
  if (tier < DAILY_BOX.glow.minTier) return `${tier + 1} days in a row: a chance of glow bait`;
  return `${tier + 1} days in a row: a bigger box`;
}

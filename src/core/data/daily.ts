/** Tunables for the daily bait box (slice 13a). */
export const DAILY_BOX = {
  /** Streak tiers run 1..maxTier. */
  maxTier: 5,
  /** Worms in a plain tier-1 box (always). */
  worms: { min: 5, max: 10 },
  /** Coins in a plain tier-1 box, and how often a box has any. */
  coins: { min: 15, max: 40, chance: 0.8 },
  /** A lucky box multiplies everything. */
  luckyChance: 0.05,
  luckyMultiplier: 3,
  /** The tier multiplier runs linearly from x1 at tier 1 to this at maxTier. */
  topTierMultiplier: 2,
} as const;

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
  /** Slice 15c, tier 2 and up: a chance of 1-3 glow bait (25% at tier 2, rising linearly to the top tier's value). */
  glow: { minTier: 2, chanceAtMinTier: 0.25, chanceAtMaxTier: 0.6, min: 1, max: 3 },
  /** A small chance of a shop bait pack on top (any tier): 3-5 corn / maggots / fish strip. */
  pack: { chance: 0.15, min: 3, max: 5 },
} as const;

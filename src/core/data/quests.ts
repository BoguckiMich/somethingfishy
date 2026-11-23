/**
 * Tunables for the daily quests (slice 13b).
 *
 * Pacing: a catch takes ~35-50 s of real play (2.5-8 s wait, a few nibbles, an 8-15 s fight, a
 * 3-5 s show-off, the next cast), so ~1.2 catches a minute. One game day is 20 real minutes, so
 * dawn and dusk windows are only ~1.7 min each and night ~7.5 min; the day pool is ~9 min.
 * The three quests run in parallel (one catch can advance several), so the whole set should take
 * ~20-40 min of play:
 *  - catchAny 8-15: about 7-13 min of fishing; kept modest so a cozy daily never feels like a grind.
 *  - catchSpecies: common 3-5 (a given common fish is ~20-25 % of the bites of its time slot, and
 *    most bite only in daylight, so this is ~15-30 min), uncommon 1-2 (rarer, ~10-30 % of a slot,
 *    some only at night), rare 1 (the catfish: ~7 % of night bites in deep water, so it may need
 *    more than one night; that is what the reroll is for, and the pick is weighted away from it).
 *  - catchAtTime: dawn and dusk are short, so 1-2 there; night is long, so 2-3.
 *  - catchDeep 2-4: with a deep rod she has to cast far; ~3-6 min.
 *  - sellCoins: since slice 15a (rarity multipliers, priceMin 0.7) a fish sells for ~4-50 coins in
 *    shallow water (a mid-size common one ~5-10) and ~25-340 in deep water (income is ~1.2x for
 *    commons, ~1.6x for uncommons, 2.4x for the rare catfish; ~1.3-1.5x overall), so the targets
 *    were raised ~1.3x to keep "a bag-load of fish": 80-160 coins (shallow-only rods) or 200-400 (deep rod).
 *  - beatRecord: a strictly longer fish of a species already in the log; lengths skew small, so
 *    one record takes a few catches of the same kind.
 * Rewards grow with the target inside each kind's range (and with rarity for catchSpecies).
 */
export const QUEST_TUNING = {
  /** Quests on the board each day (all of different kinds). */
  perDay: 3,
  /** A beat-a-record quest needs this many species in the log already. */
  beatRecordMinSpecies: 3,
  /** Deep quests need a rod that casts at least this far (the deep zone starts at 15 m). */
  deepMinCastM: 15,
  /** Chance weight of a species as a catchSpecies target, by rarity (rare ones are mean to ask for). */
  speciesWeight: { common: 3, uncommon: 2, rare: 1, legendary: 0 },
  /** Target ranges (inclusive). */
  catchSpecies: { common: [3, 5], uncommon: [1, 2], rare: [1, 1] },
  catchAny: [8, 15],
  catchAtTime: { dawn: [1, 2], dusk: [1, 2], night: [2, 3] },
  catchDeep: [2, 4],
  sellCoins: { shallowRod: [80, 160], deepRod: [200, 400] },
  /** Rewards: coins and worms, interpolated by where the target sits in its range (0 = easiest). */
  rewards: {
    'catchSpecies.common': { coins: [20, 30], worms: [3, 4] },
    'catchSpecies.uncommon': { coins: [30, 45], worms: [4, 5] },
    'catchSpecies.rare': { coins: [55, 60], worms: [5, 6] },
    catchAny: { coins: [20, 35], worms: [3, 4] },
    catchAtTime: { coins: [25, 40], worms: [3, 5] },
    catchDeep: { coins: [30, 50], worms: [4, 5] },
    sellCoins: { coins: [20, 40], worms: [3, 4] },
    beatRecord: { coins: [40, 40], worms: [5, 5] },
  },
} as const;

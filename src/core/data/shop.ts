/** Shop and starting values (GAME_DESIGN §3 item 5). Tunable data, no logic. */
export const SHOP = {
  startWorms: 10,
  startCoins: 0,
  /** Slots in the bag. */
  bagSlots: 10,
  /** One pack of worms. */
  wormPackSize: 10,
  wormPackPrice: 10,
  /** The soft-lock guard: worms handed out when the player has nothing left. */
  freeWorms: 5,
  /** Chance that a fish lost in the fight takes the worm with it. */
  lostFightWormChance: 0.5,
  /** Sell price = basePrice * rarityMult * (priceMin + priceSpan * size position in the species range). */
  priceMin: 0.7,
  priceSpan: 1,
};

/**
 * Fish caught in deep night (02:00 to 05:00 on the game clock, the hours only the night kit lets her fish, and the "Deep night" nap
 * option) sell for this share (balance A2, lever 2 of the economy pass: the nap card skips straight there for free). The price is
 * fixed at catch time, like the fish-of-the-day bonus.
 */
export const DEEP_NIGHT_PRICE_MULT = 0.85;

/** Price multiplier by rarity (slice 15a). The Pale One is never sold (basePrice 0), so its 0 is a formality. */
export const RARITY_PRICE_MULT = { common: 1, uncommon: 1.3, rare: 2, legendary: 0, trophy: 1 } as const;

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
  /** Sell price = basePrice * (priceMin + priceSpan * size position in the species range). */
  priceMin: 0.5,
  priceSpan: 1,
};

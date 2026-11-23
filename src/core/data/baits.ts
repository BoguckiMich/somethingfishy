import type { Rarity } from './fish';

/**
 * Baits (slice 15c). Worms are the default and catch everything as before; the special baits shift
 * the odds a little. A bait only reweights species that zone + time already allow, and never
 * affects the legendary (its spawn is a separate rule, see core/legendary.ts).
 *
 * Prices (shop packs of 10), checked against slice 15a income: a common fish sells for ~4-12 and a
 * deep one for 20-100, a worm costs 1 coin, and one bait is used per caught fish (half the time on
 * a lost fight). So a bait must cost clearly less than the fish it is meant to attract:
 *   corn     3 coins each, for crucian (~8) and bream / tench / carp (20-70)
 *   maggots  2 coins each, speeds up shallow fishing where fish sell for ~4-14
 *   strip    4 coins each, for pike / zander / eel / catfish (22-170)
 * Glow bait is not sold (daily box and quests only).
 */
export interface Bait {
  id: string;
  name: string;
  /** Capitalised, shown in the shop and the picker. */
  effect: string;
  /** Shop pack; absent = not sold. */
  pack?: { size: number; price: number };
  /** Spawn weight x`factor` for these species... */
  speciesBoost?: { ids: readonly string[]; factor: number };
  /** ...or for every species of this rarity. */
  rarityBoost?: { rarity: Rarity; factor: number };
  /** The wait before the first bite x`factor` in this zone. */
  waitFactor?: { zone: 'shallow' | 'deep'; factor: number };
}

/** The default bait: `PlayerState.worms`, catches everything. */
export const WORM_ID = 'worm';

export const BAITS: Bait[] = [
  {
    id: 'corn', name: 'Corn', effect: 'Carp, tench, bream and crucian bite 3x as often',
    pack: { size: 10, price: 30 },
    speciesBoost: { ids: ['carp', 'tench', 'bream', 'crucian'], factor: 3 },
  },
  {
    id: 'maggots', name: 'Maggots', effect: 'Bites come sooner in shallow water',
    pack: { size: 10, price: 20 },
    waitFactor: { zone: 'shallow', factor: 0.6 },
  },
  {
    id: 'strip', name: 'Fish strip', effect: 'Pike, zander, eel and catfish bite 3x as often',
    pack: { size: 10, price: 40 },
    speciesBoost: { ids: ['pike', 'zander', 'eel', 'catfish'], factor: 3 },
  },
  {
    id: 'glow', name: 'Glow bait', effect: 'Rare fish bite 3x as often',
    rarityBoost: { rarity: 'rare', factor: 3 },
  },
];

export const baitById = (id: string | undefined): Bait | undefined => BAITS.find((b) => b.id === id);

/** The baits the shop sells. */
export const SHOP_BAITS: Bait[] = BAITS.filter((b) => b.pack);

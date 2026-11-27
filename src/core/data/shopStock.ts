import { SHOP_BAITS } from './baits';
import { CAMP_ITEMS } from './camp';
import { NIGHT_KIT } from './nightKit';
import { RODS } from './rods';
import { TREATS } from './treats';
import { LINES, REELS } from './tackle';
import { RIVER_GEAR_ITEMS } from './riverGear';

/** What one place's shop sells, as item ids by section (slice 29). Owned gear stays owned and usable everywhere; this only gates buying. */
export interface ShopStock {
  /** Worm pack ('worms') and the special bait packs. */
  bait: readonly string[];
  /** Rods, lines, reels and the night kit (item ids). */
  gear: readonly string[];
  /** Camp items (the camp stands at the lake). */
  camp: readonly string[];
  /** Shown in place of the Upgrades list when `gear` has nothing for sale here; omitted when the place sells gear. */
  gearEmpty?: string;
  /** The gear section's title when it is not the lake's "Upgrades" (the river's "River tackle"). */
  gearTitle?: string;
}

/** Worms, the basic bait packs (corn, maggots, strip) and the dog treats (slice 30), sold at every place. */
export const BASIC_BAIT: readonly string[] = ['worms', ...SHOP_BAITS.map((b) => b.id), TREATS.id];

/** Quiet Lake sells exactly what the shop sold before slice 29. */
export const QUIET_LAKE_STOCK: ShopStock = {
  bait: BASIC_BAIT,
  gear: [...RODS.filter((r) => r.price > 0).map((r) => r.id), ...LINES.map((l) => l.id), ...REELS.map((r) => r.id), NIGHT_KIT.id],
  camp: CAMP_ITEMS.map((c) => c.id),
};

/** River bend: the basics and the "River tackle" section (the trotting float and heavy lead, slice 25g; the spinning rod joins in slice 32). Camp items stay at the lake. */
export const RIVER_BEND_STOCK: ShopStock = {
  bait: BASIC_BAIT,
  gear: RIVER_GEAR_ITEMS.map((g) => g.id),
  camp: [],
  gearTitle: 'River tackle',
};

/** Is this item id sold under this stock (any section)? */
export const sold = (stock: ShopStock, id: string): boolean => stock.bait.includes(id) || stock.gear.includes(id) || stock.camp.includes(id);

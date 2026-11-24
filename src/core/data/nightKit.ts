/** The night kit "Lantern & blanket" (GAME_DESIGN section 3, slice 16). Rules live in core/inventory.ts and core/bedtime.ts. */
export const NIGHT_KIT = {
  /** Item id: the shop icon (art/shopIconArt.ts) and the shop card use it. */
  id: 'lantern',
  name: 'Lantern & blanket',
  price: 2500,
  /** Sold once this rod, or a better one, is owned. */
  needsRodId: 'fiberglass',
  effect: 'No more 02:00 bedtime: stay up and fish all night. A warm lantern glows from 20:00 to 05:00',
};

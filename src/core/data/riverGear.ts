/**
 * River gear (slice 25g, RIVER_BEND.md section 7 question 5): two passive items sold in the River bend's "River tackle" section, bought once,
 * owned forever and always on (like the line and reel). What they do lives in `core/current.ts` (`RIVER_GEAR`); they act only where the place
 * has a `current`, so at Quiet Lake they do nothing. Each waits for finished RIVER checklist bundles (`data/gearGates.ts`).
 */
export interface RiverGearItem {
  id: 'float' | 'lead';
  name: string;
  price: number;
  effect: string;
  /** The `PlayerState` flag that says it is owned. */
  flag: 'riverFloat' | 'riverLead';
}

export const RIVER_GEAR_ITEMS: readonly RiverGearItem[] = [
  { id: 'float', name: 'Trotting float', price: 700, effect: 'A long float that rides the current slowly: more time in the seam', flag: 'riverFloat' },
  { id: 'lead', name: 'Heavy lead', price: 900, effect: 'Holds the bait down in the bend pool: it drifts less and bites more', flag: 'riverLead' },
];

export const riverGearItem = (id: string): RiverGearItem | undefined => RIVER_GEAR_ITEMS.find((g) => g.id === id);

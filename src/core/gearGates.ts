import { doneCount } from './checklist/checklist';
import { GEAR_GATES } from './data/gearGates';
import type { PlayerState } from './inventory';

/** Finished checklist bundles. */
export const bundlesDone = (p: PlayerState): number => doneCount(p);

/** Bundles an item needs (0 = open from the start). */
export const gateFor = (itemId: string): number => GEAR_GATES[itemId] ?? 0;

/** Can this item be bought now? Only the shop asks: gear already owned stays owned and usable whatever the gate says. */
export const gearUnlocked = (itemId: string, p: PlayerState): boolean => bundlesDone(p) >= gateFor(itemId);

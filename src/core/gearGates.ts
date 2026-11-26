import { bundleById, bundleDone, doneCount } from './checklist/checklist';
import { CHECKLIST } from './data/checklist';
import { GEAR_GATES, type GearGate } from './data/gearGates';
import type { PlayerState } from './inventory';

/** Finished checklist bundles (all of them, Duck Tax and Petrol Money too). */
export const bundlesDone = (p: PlayerState): number => doneCount(p);

/** What an item waits for (undefined = open from the start). */
export const gateFor = (itemId: string): GearGate | undefined => GEAR_GATES[itemId];

/** Finished bundles that count toward a gate of the `count` kind. */
const countedDone = (gate: { excluding: readonly string[] }, p: PlayerState): number =>
  CHECKLIST.filter((b) => !gate.excluding.includes(b.id) && bundleDone(p, b.id)).length;

/** Can this item be bought now? Only the shop asks: gear already owned stays owned and usable whatever the gate says. */
export function gearUnlocked(itemId: string, p: PlayerState): boolean {
  const gate = gateFor(itemId);
  if (!gate) return true;
  return 'bundle' in gate ? bundleDone(p, gate.bundle) : countedDone(gate, p) >= gate.count;
}

/** The lock line of a shop card: "Unlocks after The Bottom of Things", or "Unlocks after a main checklist bundle (0/1)". */
export function gateText(itemId: string, p: PlayerState): string {
  const gate = gateFor(itemId);
  if (!gate) return '';
  if ('bundle' in gate) return `Unlocks after ${bundleById(gate.bundle)?.name ?? 'a checklist bundle'}`;
  const have = Math.min(gate.count, countedDone(gate, p));
  return `Unlocks after ${gate.count === 1 ? 'a main checklist bundle' : `${gate.count} main checklist bundles`} (${have}/${gate.count})`;
}

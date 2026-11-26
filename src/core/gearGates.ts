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

/** Where the checklist is, said on every lock line: the car opens the road map, which has the Quiet Lake checklist button. */
export const CHECKLIST_WHERE = 'Quiet Lake checklist: tap the car';

/** The lock line of a shop card: "Finish The Bottom of Things (Quiet Lake checklist: tap the car)", or the same for "a main bundle (0/1)". */
export function gateText(itemId: string, p: PlayerState): string {
  const gate = gateFor(itemId);
  if (!gate) return '';
  if ('bundle' in gate) return `Finish ${bundleById(gate.bundle)?.name ?? 'a checklist bundle'} (${CHECKLIST_WHERE})`;
  const have = Math.min(gate.count, countedDone(gate, p));
  return `Finish ${gate.count === 1 ? 'a main bundle' : `${gate.count} main bundles`} ${have}/${gate.count} (${CHECKLIST_WHERE})`;
}

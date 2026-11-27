import { bundleById, bundleDone, bundlesOf, doneCount } from './checklist/checklist';
import { GEAR_GATES, type GearGate } from './data/gearGates';
import type { PlayerState } from './inventory';

/** Finished checklist bundles (all of them, Duck Tax and Petrol Money too). */
export const bundlesDone = (p: PlayerState): number => doneCount(p);

/** What an item waits for (undefined = open from the start). */
export const gateFor = (itemId: string): GearGate | undefined => GEAR_GATES[itemId];

/** Finished bundles that count toward a gate of the `count` kind. */
const countedDone = (gate: { excluding: readonly string[]; place?: string }, p: PlayerState): number =>
  bundlesOf(gate.place).filter((b) => !gate.excluding.includes(b.id) && bundleDone(p, b.id)).length;

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
  if (gate.place) return `Unlocks after ${gate.count} river checklist ${gate.count === 1 ? 'bundle' : 'bundles'} (${have}/${gate.count})`;
  return `Finish ${gate.count === 1 ? 'a main bundle' : `${gate.count} main bundles`} ${have}/${gate.count} (${CHECKLIST_WHERE})`;
}

/** Shop gear that finishing this bundle just opened (called right after it is handed in): its own bundle gate, or a count gate it just reached. */
export function gearOpenedBy(bundleId: string, p: PlayerState): string[] {
  return Object.entries(GEAR_GATES)
    .filter(([id, gate]) => ('bundle' in gate ? gate.bundle === bundleId : bundlesOf(gate.place).some((b) => b.id === bundleId) && !gate.excluding.includes(bundleId) && countedDone(gate, p) === gate.count) && gearUnlocked(id, p))
    .map(([id]) => id);
}

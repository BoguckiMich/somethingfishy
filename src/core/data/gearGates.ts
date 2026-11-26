/**
 * Shop gear gates (slice 23a, reworked in balance A2, 2026-11-26): what must be finished on the checklist before an item can be
 * bought (coins still pay). An id that is not listed is open from the start (bamboo, fiberglass rod, worms, baits). The night kit
 * keeps its own rule (a fiberglass rod, `core/data/nightKit.ts`).
 *
 * A gate is a named bundle (the deep rod waits for the bottom-feeders, the best line and reel for the night fish) or a count of the
 * main bundles. Duck Tax (one bleak) and Petrol Money (500 coins) never count: one is a gift and the other is only coins, so they
 * would open the shop without any real fishing.
 */
export type GearGate = { bundle: string } | { count: number; excluding: readonly string[] };

const MAIN_ONLY = ['duck-tax', 'petrol'] as const;

export const GEAR_GATES: Readonly<Record<string, GearGate>> = {
  braided: { count: 1, excluding: MAIN_ONLY },
  smooth: { count: 1, excluding: MAIN_ONLY },
  carbon: { bundle: 'bottom-of-things' },
  fluoro: { bundle: 'night-shift' },
  pro: { bundle: 'night-shift' },
};

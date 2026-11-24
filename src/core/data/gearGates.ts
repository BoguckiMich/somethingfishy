/**
 * Shop gear gates (slice 23a): how many finished checklist bundles an item needs before it can be
 * bought (coins still pay). An id that is not listed is open from the start (bamboo, fiberglass rod,
 * worms, baits). The night kit keeps its own rule (a fiberglass rod, `core/data/nightKit.ts`).
 */
export const GEAR_GATES: Readonly<Record<string, number>> = {
  braided: 1,
  smooth: 1,
  carbon: 2,
  fluoro: 4,
  pro: 4,
};

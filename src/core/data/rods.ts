import type { Rod } from '../gear';

// Starter rod only reaches shallow water (< 15 m) — upgrades unlock the deep zone.
export const RODS: Rod[] = [
  { id: 'bamboo', name: 'Bamboo Rod', maxCastM: 14 },
  { id: 'fiberglass', name: 'Fiberglass Rod', maxCastM: 26 },
  { id: 'carbon', name: 'Carbon Rod', maxCastM: 40 },
];

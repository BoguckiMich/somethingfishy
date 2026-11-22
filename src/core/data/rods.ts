import type { Rod } from '../gear';
import { STARTER_BAR_GEAR } from './barGear';

// Starter rod only reaches shallow water (< 15 m) — upgrades unlock the deep zone.
// Rods are bought in this order; each one reaches further and widens the catch zone.
export const RODS: Rod[] = [
  { id: 'bamboo', name: 'Bamboo Rod', maxCastM: 14, price: 0, barGear: STARTER_BAR_GEAR },
  { id: 'fiberglass', name: 'Fiberglass Rod', maxCastM: 26, price: 250, barGear: { ...STARTER_BAR_GEAR, zoneSize: 0.34 } },
  { id: 'carbon', name: 'Carbon Rod', maxCastM: 40, price: 1200, barGear: { ...STARTER_BAR_GEAR, zoneSize: 0.38 } },
];

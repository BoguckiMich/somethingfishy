import type { Line, Reel } from '../gear';

/**
 * Line and reel upgrades (slice 15a). Two tracks, each bought in order like rods and always on once
 * owned; the player starts with neither. Their multipliers are applied to the rod's catch-bar values
 * by `effectiveBarGear` (core/inventory.ts); the rod still gives the zone size.
 *
 * Line: `drain` scales how fast progress drains while the fish is outside the zone (lower = easier).
 * Reel: `response` scales `reelResponse`, how eagerly the zone follows the thumb (higher = easier).
 * Both were checked with the catch-bar bots (catchBar.test.ts, "tackle"): see the numbers there.
 */
export const LINES: Line[] = [
  { id: 'braided', name: 'Braided line', price: 600, drain: 0.85, effect: 'progress drains 15% slower' },
  { id: 'fluoro', name: 'Fluoro line', price: 2000, drain: 0.7, effect: 'progress drains 30% slower' },
];

export const REELS: Reel[] = [
  { id: 'smooth', name: 'Smooth reel', price: 1000, response: 1.2, effect: 'the zone follows your thumb 20% faster' },
  { id: 'pro', name: 'Pro reel', price: 3500, response: 1.4, effect: 'the zone follows your thumb 40% faster' },
];

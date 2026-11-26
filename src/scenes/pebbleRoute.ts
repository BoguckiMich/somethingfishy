import { distanceToY } from '../art/layout';
import { skipPlan } from '../core/skipping';

/**
 * Where a skipped pebble touches the water (slice 26b): Pajkel throws from the near shore left of the dock, so the pebble flies out over the LEFT
 * part of the water, up the screen and away to the left, clear of the dock, Alex and the bobber. Pure, no Phaser.
 */
export const PEBBLE_ROUTE = {
  /** The whole flight drifts this far left (px, at the last touch-down); the swipe's sideways part moves it by up to `sideX` either way. */
  driftX: -44,
  sideX: 20,
  /** Always at least this far from the left edge (the number pops are 6 px wide), and never past the dock's left side (x 116). */
  minX: 14,
  maxX: 100,
};

export interface RoutePoint {
  x: number;
  y: number;
}

/** The touch-down points of a pebble of `skips` skips thrown from `from` (his hand) with the swipe's drift `side` (-1..1); the last one is where it sinks. */
export function pebbleRoute(skips: number, side: number, from: RoutePoint): RoutePoint[] {
  const plan = skipPlan(skips);
  const last = plan[plan.length - 1];
  // Near the shore the water sits low on the screen; with distance the points rise into the usual lake perspective.
  const lift = Math.max(0, from.y - distanceToY(0));
  return plan.map((d) => {
    const t = d / last;
    return {
      x: Math.max(PEBBLE_ROUTE.minX, Math.min(PEBBLE_ROUTE.maxX, from.x + (PEBBLE_ROUTE.driftX + side * PEBBLE_ROUTE.sideX) * t)),
      y: distanceToY(d) + lift * (1 - t),
    };
  });
}

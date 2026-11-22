import { QUIET_LAKE } from '../core/data/locations';

// Layout of the lake screen (base resolution 360×640, portrait). Shared by the scene and the art.
export const W = 360;
export const H = 640;
export const FAR_SHORE_Y = 150; // where the water starts at the top
export const FAR_WATER_Y = 170; // y of the farthest castable point (location.maxDistanceM)
export const SHORE_Y = 520; // y of distance 0 (the near shore)
export const ROD_TIP = { x: 214, y: 508 };
export const BOBBER_X = 214;

/** The water texture runs a little below SHORE_Y so the shoreline overlaps it. */
export const WATER_BOTTOM = 532;
export const DOCK = { x: 146, y: 486, w: 72, h: 108 };
export const NEAR_SHORE_TOP = 506;
export const FAR_SHORE_TOP = 74;

/** Converts a cast distance in meters into a screen y coordinate. */
export function distanceToY(distanceM: number): number {
  const t = distanceM / QUIET_LAKE.maxDistanceM;
  return SHORE_Y - t * (SHORE_Y - FAR_WATER_Y);
}

/** y of the shallow/deep boundary. */
export const ZONE_BOUNDARY_Y = distanceToY(QUIET_LAKE.zones[0].toM);

import { QUIET_LAKE } from '../core/data/locations';

// Layout of the lake screen (base resolution 360×640, portrait). Shared by the scene and the art.
export const W = 360;
export const H = 640;
export const FAR_SHORE_Y = 172; // where the water starts at the top
export const FAR_WATER_Y = 192; // y of the farthest castable point (location.maxDistanceM)
export const SHORE_Y = 452; // the shoreline (water ends, sand starts)
export const ROD_TIP = { x: 256, y: 342 };
export const BOBBER_X = 256;

/** The water texture runs a little below SHORE_Y so the shoreline overlaps it. */
export const WATER_BOTTOM = SHORE_Y + 12;
export const DOCK = { x: 116, y: 358, w: 128, h: 112 };
export const NEAR_SHORE_TOP = SHORE_Y - 14;
export const FAR_SHORE_TOP = FAR_SHORE_Y - 100;

/** 0 m is the water just in front of the dock end, where the angler sits. */
export const ORIGIN_Y = 346;
/** Perspective-like exponent: near water gets more screen space than far water. */
export const DISTANCE_EXPONENT = 0.65;

/** Converts a cast distance in meters into a screen y coordinate (monotonic, 0 m = ORIGIN_Y). */
export function distanceToY(distanceM: number): number {
  const t = Math.min(1, Math.max(0, distanceM / QUIET_LAKE.maxDistanceM));
  return ORIGIN_Y - (ORIGIN_Y - FAR_WATER_Y) * Math.pow(t, DISTANCE_EXPONENT);
}

/** y of the shallow/deep boundary. */
export const ZONE_BOUNDARY_Y = distanceToY(QUIET_LAKE.zones[0].toM);

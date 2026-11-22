/** A depth zone of a fishing spot, measured as cast distance from the shore in meters. */
export interface Zone {
  id: ZoneId;
  name: string;
  /** Inclusive start, in meters from the shore. */
  fromM: number;
  /** Exclusive end, in meters from the shore. */
  toM: number;
}

export type ZoneId = 'shallow' | 'deep';

export interface Location {
  id: string;
  name: string;
  /** Farthest castable point of this location, in meters. */
  maxDistanceM: number;
  /** Ordered from shore outwards, contiguous. */
  zones: Zone[];
}

/** Returns the zone a bobber at `distanceM` lands in. Distances past the end clamp to the last zone. */
export function zoneAt(location: Location, distanceM: number): Zone {
  const zone = location.zones.find((z) => distanceM >= z.fromM && distanceM < z.toM);
  return zone ?? location.zones[location.zones.length - 1];
}

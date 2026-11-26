/** The depth class of a zone that species and rare-fish rules are written against: a lake's shallow/deep, a river's riffle/seam count as shallow, its pool as deep. */
export type ZoneId = 'shallow' | 'deep';

/** A depth zone of a fishing spot, measured as cast distance from the shore in meters. */
export interface Zone {
  /** The place's own name for the band ('shallow', 'riffle', 'seam', 'pool'...). */
  id: string;
  name: string;
  /** Inclusive start, in meters from the shore. */
  fromM: number;
  /** Exclusive end, in meters from the shore. */
  toM: number;
  /** Which depth class fish rules treat this band as. */
  fishZone: ZoneId;
  /**
   * This band's own fish (M2 groundwork A): a weight multiplier per species id that REPLACES the location's `fishPool.species`
   * for casts landing here. Absent = inherit the location's pool. Every id must also be in the location's pool (`livesAt`).
   */
  fishPool?: Readonly<Record<string, number>>;
  /**
   * Size bias of this band (slice 25d): the length-roll exponent per species id, replacing the species' own (higher = smaller fish).
   * The river's chub is small in the riffle and big in the bend pool.
   */
  sizeSkew?: Readonly<Record<string, number>>;
}

export interface Point {
  x: number;
  y: number;
}

export interface PlayArea {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Which fish a place has: a weight multiplier per species id (absent = does not live here), and whether the trophies and the legendary may bite. */
export interface FishPool {
  species: Readonly<Record<string, number>>;
  /**
   * True for a band's own list (slice 25d): every species in it may bite whatever its depth class, so a river's pool can
   * hold the perch (a shallow species). The lake's pool is not exact: a fish bites only in its own depth class.
   */
  exact?: boolean;
  /** The band's size bias (see `Zone.sizeSkew`). */
  sizeSkew?: Readonly<Record<string, number>>;
  /** The rare trophy fish and the legendary of this place (rules in core/rare.ts and core/legendary.ts). */
  specials: boolean;
}

/** The pebble outing of the companions (slice 26b): where Pajkel stands at the stones and how they walk there. */
export interface ShoreSpots {
  /** His feet at the stones, and where Bestia sits beside him. */
  stand: Point;
  dogSit: Point;
  /** From the chair: the waypoint along the front of the dock (him, her). */
  pajDockVia: Point;
  dogDockVia: Point;
  /** From the grass: when he stands below `belowY` he first walks up to `y` (never left of `minX`); she goes via `dogVia`. */
  pajLane: { belowY: number; y: number; minX: number };
  dogVia: Point;
}

/** Everything the companions (scenes/companions/behaviour.ts) need to know about a place's ground (M2 groundwork B). The lawn is `Spots.playArea`; the fire and the dog bed come from `Spots.camp`. */
export interface CompanionSpots {
  /** Feet on the landing: his chair, and where Bestia lies. */
  paj: Point;
  dog: Point;
  /** Two waypoints each from the landing down to the grass (nearest the landing first). */
  pajDown: Point[];
  dogDown: Point[];
  /** Feet above this y are still on the planks, below it on the grass. */
  grassY: number;
  /** Where they stand when a play session starts. */
  playPaj: Point;
  playDog: Point;
  /** Where Pajkel stands to get in and out of the car, and where Bestia waits beside him. */
  carStand: Point;
  carDog: Point;
  /** The zone below the campfire where his head would cover the flames (`halfW` either side, `below` its feet) and where he is nudged to. */
  fireKeepOff: { halfW: number; below: number; standX: number };
  /** Bestia's playful run to the car at bedtime: x ranges right and left of `midX`, a y range, and the last waypoint's ranges. */
  zigzag: { midX: number; rightX: [number, number]; leftX: [number, number]; y: [number, number]; homeX: [number, number]; homeY: [number, number] };
  /** The pebble outing; null at a place without skipping stones. */
  shore: ShoreSpots | null;
}

/** Where things stand in the 360 x 640 scene (feet = bottom middle unless noted). */
export interface Spots {
  /** Top-left of the dock / landing picture. */
  dock: Point;
  /** Top-left of the parked car, and its tap area. */
  car: Point;
  carHit: { x: number; y: number; w: number; h: number };
  sign: Point;
  crate: Point;
  trophy: Point;
  lantern: Point;
  /** Top-left of the skipping stones on the near shore (slice 26); a place without them (the River bend) omits it. */
  stones?: Point;
  camp: { tent: Point; pole: Point; fire: Point; bed: Point; sock: Point };
  /** Where the companions stand, walk and play (M2 groundwork B). */
  companions: CompanionSpots;
  /** The fetch lawn of the companions. */
  playArea: PlayArea;
}

/** Which picture painter the scene uses for a place. */
export type BackgroundId = 'lake' | 'river';

export interface Location {
  id: string;
  name: string;
  /** Farthest castable point of this location, in meters. */
  maxDistanceM: number;
  /** Ordered from shore outwards, contiguous. */
  zones: Zone[];
  fishPool: FishPool;
  background: BackgroundId;
  spots: Spots;
  /** Lake moments (core/moments) that play here; null = none. */
  momentsId: string | null;
  /** The checklist of this place (core/data/checklist); null = none yet. */
  checklistId: string | null;
  /** The place id the story chapters are told at; null = no chapters here. */
  storyPlaceId: string | null;
}

/** Returns the zone a bobber at `distanceM` lands in. Distances past the end clamp to the last zone. */
export function zoneAt(location: Location, distanceM: number): Zone {
  const zone = location.zones.find((z) => distanceM >= z.fromM && distanceM < z.toM);
  return zone ?? location.zones[location.zones.length - 1];
}

/** The pool of one band: its own species if it has any (exact, see `FishPool.exact`), else the location's; the trophies flag always comes from the location. */
function poolOfZone(location: Location, zone: Zone): FishPool {
  return zone.fishPool
    ? { species: zone.fishPool, exact: true, specials: location.fishPool.specials, ...(zone.sizeSkew ? { sizeSkew: zone.sizeSkew } : {}) }
    : location.fishPool;
}

/** The fish pool for a cast landing at `distanceM`. */
export const poolAt = (location: Location, distanceM: number): FishPool => poolOfZone(location, zoneAt(location, distanceM));

/** May this species (with this depth class) bite in a band whose depth class is `zone` and whose pool is `pool`? */
export const biteableIn = (pool: FishPool, speciesId: string, speciesZone: ZoneId, zone: ZoneId): boolean =>
  pool.species[speciesId] !== undefined && (pool.exact === true || speciesZone === zone);

/** Can this species bite anywhere a cast of `reachM` meters lands at the location (daily quests and the fish of the day only ask for what she can catch)? */
export const canBiteWithin = (location: Location, species: { id: string; zone: ZoneId }, reachM: number): boolean =>
  location.zones.some((z) => z.fromM < reachM && biteableIn(poolOfZone(location, z), species.id, species.zone, z.fishZone));

/** The bands of the location where this species can bite, in order from the shore. */
export const zonesOfSpecies = (location: Location, species: { id: string; zone: ZoneId }): Zone[] =>
  location.zones.filter((z) => biteableIn(poolOfZone(location, z), species.id, species.zone, z.fishZone));

/** The depth classes this much reach covers on the location, in zone order, no duplicates. */
export function reachableFishZones(location: Location, reachM: number): ZoneId[] {
  const out: ZoneId[] = [];
  for (const z of location.zones) if (z.fromM < reachM && !out.includes(z.fishZone)) out.push(z.fishZone);
  return out;
}

/** Can this species bite at the location (it is in the pool)? */
export const livesAt = (location: Location, speciesId: string): boolean => location.fishPool.species[speciesId] !== undefined;

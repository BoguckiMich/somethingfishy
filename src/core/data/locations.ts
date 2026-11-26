import type { CompanionSpots, Location } from '../location';
import { POOL_SPECIES } from './fish';

/** Every fish that bites at the lake with the plain weight (the trophies and the legendary are rolled apart, see `specials`). */
const LAKE_FISH: Record<string, number> = Object.fromEntries(POOL_SPECIES.map((s) => [s.id, 1]));

/** The companions' ground at Quiet Lake: what the behaviour had as constants before M2 groundwork B (a test keeps them equal). */
const QUIET_COMPANIONS: CompanionSpots = {
  paj: { x: 150, y: 406 },
  dog: { x: 178, y: 430 },
  pajDown: [{ x: 148, y: 440 }, { x: 148, y: 484 }],
  dogDown: [{ x: 178, y: 444 }, { x: 178, y: 486 }],
  grassY: 470,
  playPaj: { x: 112, y: 540 },
  playDog: { x: 140, y: 544 },
  carStand: { x: 34, y: 560 },
  carDog: { x: 60, y: 564 },
  fireKeepOff: { halfW: 22, below: 46, standX: 130 },
  zigzag: { midX: 200, rightX: [240, 320], leftX: [90, 150], y: [508, 584], homeX: [100, 124], homeY: [548, 566] },
  // The stones are at x 93-115, y 460-472: he stands just left of them and a step in front, and Bestia beside him.
  shore: {
    stand: { x: 80, y: 479 },
    dogSit: { x: 54, y: 485 },
    pajDockVia: { x: 140, y: 480 },
    dogDockVia: { x: 160, y: 488 },
    pajLane: { belowY: 488, y: 484, minX: 140 },
    dogVia: { x: 120, y: 488 },
  },
};

export const QUIET_LAKE: Location = {
  id: 'quiet-lake',
  name: 'Quiet Lake',
  maxDistanceM: 40,
  zones: [
    { id: 'shallow', name: 'Shallow water', fromM: 0, toM: 15, fishZone: 'shallow' },
    { id: 'deep', name: 'Deep water', fromM: 15, toM: 40, fishZone: 'deep' },
  ],
  fishPool: { species: LAKE_FISH, specials: true },
  background: 'lake',
  spots: {
    dock: { x: 116, y: 358 },
    car: { x: 0, y: 500 },
    carHit: { x: 0, y: 494, w: 84, h: 58 },
    sign: { x: 276, y: 498 },
    crate: { x: 214, y: 458 },
    trophy: { x: 58, y: 492 },
    lantern: { x: 180, y: 388 },
    stones: { x: 93, y: 458 },
    camp: { tent: { x: 14, y: 494 }, pole: { x: 85, y: 447 }, fire: { x: 106, y: 497 }, bed: { x: 80, y: 555 }, sock: { x: 330, y: 496 } },
    playArea: { x0: 100, x1: 322, y0: 500, y1: 554 },
    companions: QUIET_COMPANIONS,
  },
  momentsId: 'lake',
  checklistId: 'quiet-lake',
  storyPlaceId: 'quiet-lake',
};

/**
 * The River bend (slice 25a): a PLACEHOLDER. Its fish are shared lake species only (the river's own fish, the current,
 * the art, the checklist, the story and the moments come in slices 25b-25g); asp is at home here.
 */
export const RIVER_BEND: Location = {
  id: 'river-bend',
  name: 'River bend',
  maxDistanceM: 40,
  zones: [
    // Per-zone pools (M2 groundwork A) follow RIVER_BEND.md section 3/5 as far as the species exist. TODO(25d): riffle = nase, trout,
    // grayling, small chub; seam = chub, asp, barbel, vimba; pool = barbel, big chub (+ the Ferryman). Until those exist: roach stands in
    // for the nase, asp lives in the seam ("the money spot"), pike and bream hold in the slow pool.
    { id: 'riffle', name: 'Riffle', fromM: 0, toM: 12, fishZone: 'shallow', fishPool: { roach: 2, perch: 1 } },
    { id: 'seam', name: 'Seam', fromM: 12, toM: 26, fishZone: 'shallow', fishPool: { asp: 3, perch: 1, roach: 1 } },
    { id: 'pool', name: 'Bend pool', fromM: 26, toM: 40, fishZone: 'deep', fishPool: { pike: 1, bream: 1 } },
  ],
  fishPool: { species: { asp: 3, perch: 1, roach: 1.5, pike: 0.7, bream: 1 }, specials: false },
  background: 'river',
  // The river art (25b) kept the lake's near shore: landing, car, camp and the grass lawn stand where they did, so the companions walk the
  // same ground. What differs: no skipping stones (the left gravel bar is the river's own), so no pebble outing (`shore: null`). A test
  // checks every point is on land (not in the river, not in the hut), so a later layout change cannot drop them in the water.
  spots: { ...QUIET_LAKE.spots, stones: undefined, companions: { ...QUIET_COMPANIONS, shore: null } },
  momentsId: null,
  checklistId: null,
  storyPlaceId: null,
};

export const LOCATIONS: readonly Location[] = [QUIET_LAKE, RIVER_BEND];

/** The place with that id, or Quiet Lake for anything unknown. */
export const locationById = (id: string | undefined): Location => LOCATIONS.find((l) => l.id === id) ?? QUIET_LAKE;

/** Size of the road-map picture in art pixels (slice 18); the pins below sit inside it. */
export const MAP_SIZE = { w: 150, h: 110 };

export interface MapPlace {
  id: string;
  name: string;
  /** One or two lines shown under the map when the place is selected. */
  blurb: string;
  /** `open` is a place she can fish now; `soon` shows a work-in-progress sign and "Coming soon". */
  status: 'open' | 'soon';
  /** Where the pin stands on the map picture (art pixels): the tip of the pin. */
  pin: { x: number; y: number };
}

/** The places on the road map, in the order they are listed. Only Quiet Lake exists yet. */
export const MAP_PLACES: readonly MapPlace[] = [
  { id: QUIET_LAKE.id, name: 'Quiet Lake', blurb: 'Home. The fish know you here.', status: 'open', pin: { x: 34, y: 90 } },
  { id: 'river-bend', name: 'River bend', blurb: 'Moving water you read. An old ferry landing and a hut by the bank.', status: 'soon', pin: { x: 98, y: 64 } },
  { id: 'old-quarry', name: 'Old quarry', blurb: 'Deep, clear water. Something down there is waiting.', status: 'soon', pin: { x: 30, y: 50 } },
  { id: 'sea-pier', name: 'Sea pier', blurb: 'The gulls have opinions about your sandwich. Loud ones.', status: 'soon', pin: { x: 120, y: 26 } },
];

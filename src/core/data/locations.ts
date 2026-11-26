import type { CompanionSpots, Location } from '../location';
import { POOL_SPECIES } from './fish';
import { QUIET_LAKE_STOCK, RIVER_BEND_STOCK } from './shopStock';

/** The species that live at the River bend only (slice 25d): they never bite at Quiet Lake. */
const ANY_HOURS = ['dawn', 'day', 'dusk', 'night'] as const;
const RIVER_ONLY: readonly string[] = ['trout', 'grayling', 'nase', 'chub', 'barbel', 'vimba'];

/** Every fish that bites at the lake with the plain weight (the trophies and the legendary are rolled apart, see `specials`). */
const LAKE_FISH: Record<string, number> = Object.fromEntries(POOL_SPECIES.filter((s) => !RIVER_ONLY.includes(s.id)).map((s) => [s.id, 1]));

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
  // The stones are at x 93-115, y 460-472: he stands at their right, clear of the trophy board and campfire, and Bestia sits by the dock corner (she faces left, toward him).
  shore: {
    stand: { x: 122, y: 479 },
    dogSit: { x: 150, y: 484 },
    pajDockVia: { x: 140, y: 480 },
    dogDockVia: { x: 160, y: 488 },
    pajLane: { belowY: 488, y: 484, minX: 140 },
    dogVia: { x: 150, y: 489 },
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
    bowl: { x: 24, y: 553 },
    playArea: { x0: 100, x1: 322, y0: 500, y1: 554 },
    companions: QUIET_COMPANIONS,
  },
  momentsId: 'lake',
  checklistId: 'quiet-lake',
  storyPlaceId: 'quiet-lake',
  shop: QUIET_LAKE_STOCK,
};

/**
 * The River bend (slice 25a, fish 25d). The river's own species live in the bands (RIVER_BEND.md sections 3 and 5): riffle = trout, grayling,
 * nase, barbel and the small chub (the chub is filler: no species may dominate a band); seam = chub, the asp, barbel, vimba; bend pool = barbel, the rare big chub, and perch
 * and pike as slow-water visitors. The weights are multipliers on the rarity weight (common 60, uncommon 30, rare 10). The art, the
 * current, the checklist, the story and the moments come in slices 25b-25g.
 */
export const RIVER_BEND: Location = {
  id: 'river-bend',
  name: 'River bend',
  maxDistanceM: 40,
  zones: [
    // The chub's size follows the water: the length roll is skewed small in the riffle (exponent 3) and big in the pool (exponent 1).
    { id: 'riffle', name: 'Riffle', fromM: 0, toM: 12, fishZone: 'shallow', fishPool: { nase: 0.5, trout: 1.2, grayling: 1, chub: 0.5, barbel: 0.6 }, sizeSkew: { chub: 3 } },
    { id: 'seam', name: 'Seam', fromM: 12, toM: 26, fishZone: 'shallow', fishPool: { chub: 0.5, asp: 3, barbel: 1, vimba: 1 } },
    { id: 'pool', name: 'Bend pool', fromM: 26, toM: 40, fishZone: 'deep', fishPool: { barbel: 1, chub: 0.3, perch: 0.8, pike: 0.8 }, sizeSkew: { chub: 1 }, times: { perch: ANY_HOURS, pike: ANY_HOURS } },
  ],
  // Which species live here at all (the keys; the weights are the bands' own). The trophies and the legendary of the lake do not.
  fishPool: { species: { nase: 1, trout: 1, grayling: 1, chub: 1, asp: 1, barbel: 1, vimba: 1, perch: 1, pike: 1 }, specials: false },
  background: 'river',
  // The river art (25b) kept the lake's near shore: landing, car, camp and the grass lawn stand where they did, so the companions walk the
  // same ground. What differs: no skipping stones (the left gravel bar is the river's own), so no pebble outing (`shore: null`). A test
  // checks every point is on land (not in the river, not in the hut), so a later layout change cannot drop them in the water.
  spots: { ...QUIET_LAKE.spots, stones: undefined, companions: { ...QUIET_COMPANIONS, shore: null } },
  momentsId: null,
  checklistId: null,
  storyPlaceId: null,
  shop: RIVER_BEND_STOCK,
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

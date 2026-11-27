import type { TimeOfDay } from '../clock';
import type { ZoneId } from '../location';
import type { WeatherId } from './weather';

/**
 * The three rare "trophy" fish of Quiet Lake (GAME_DESIGN section 5, Pacing rework, Grill round 1; slice 23d). Each one bites only
 * when ALL of its conditions hold, then with `chance` per landed cast it replaces the normal pick (like the Pale One, core/legendary.ts).
 * The rules live in core/rare.ts; the fish themselves (sizes, art, fight pattern) are plain species with rarity 'trophy' in data/fish.ts.
 */

export interface RareRule {
  speciesId: string;
  /** The place it lives at (core/data/locations ids); it never bites anywhere else. */
  placeId: string;
  /** The place's own band it must land in (a Zone.id: the river's 'riffle', 'seam', 'pool'); missing = any band (the lake's rules use `zone`). */
  bandId?: string;
  /** The day's weather that must be on (fog counts for the whole day here, not only until 10:00). */
  weather: WeatherId;
  /** The time-of-day buckets (core/clock) the cast may happen in; missing = any. */
  times?: TimeOfDay[];
  /** A clock window in whole hours instead: from (inclusive) to (exclusive). Missing = any. */
  hours?: { from: number; to: number };
  /** The zone the bobber lands in; missing = either. */
  zone?: ZoneId;
  /** The bait on the hook (its id); missing = any. */
  baitId?: string;
  /** The bobber must land at least this far out; missing = any distance (30 m is the carbon rod only). */
  minDistanceM?: number;
  /** ... and less than this far out (the Ferry pike's seam under the rope, 18-26 m); missing = no limit. */
  maxDistanceM?: number;
  /** After it is caught, the log card says where and when, in words. */
  where: string;
}

export const RARE_TUNING = {
  /** Chance per landed cast, inside all the conditions, that the rare fish replaces the normal pick. */
  chance: 0.2,
  /** A trophy that stays outside the green zone for longer than this in one go slips away (fight code, core/catchBar.ts). */
  slipAfterMs: 2500,
  /** How long the show-off of a first catch lasts (real ms); the Pale One has 10 s, a new species 8 s. */
  showOffMs: 9000,
};

/** The ids of the places the rules are written for (the same strings as Location.id; core/data/locations imports nothing from here). */
export const LAKE_ID = 'quiet-lake';
export const RIVER_ID = 'river-bend';

/** The Ferry pike must land in the seam under the rope: the whole seam, 18 to 26 m (decided 2026-11-26, docs/RIVER_BEND.md section 5). */
export const FERRY_PIKE_BAND = { fromM: 18, toM: 26 } as const;

export const RARE_RULES: readonly RareRule[] = [
  {
    speciesId: 'goldenTench', placeId: LAKE_ID, weather: 'rain', times: ['dawn', 'dusk'], zone: 'deep', where: 'Deep water · rain · dawn or dusk',
  },
  {
    speciesId: 'mossback', placeId: LAKE_ID, weather: 'fog', baitId: 'corn', minDistanceM: 30, where: 'Far water, 30 m or more · fog · corn',
  },
  {
    speciesId: 'silverGhost', placeId: LAKE_ID, weather: 'sunny', hours: { from: 11, to: 13 }, zone: 'shallow', baitId: 'maggots', where: 'Shallow water · sunny · 11:00 to 13:00 · maggots',
  },
  // River bend (slice 25f). The bands are the river's own (`bandId`), so the lake's `zone` stays unset.
  {
    speciesId: 'lantern', placeId: RIVER_ID, weather: 'rain', times: ['night'], bandId: 'riffle', baitId: 'maggots', where: 'The riffle · rain · night · maggots',
  },
  {
    speciesId: 'barbelKing', placeId: RIVER_ID, weather: 'overcast', times: ['dusk'], bandId: 'pool', baitId: 'strip', where: 'The bend pool · overcast · dusk · fish strip',
  },
  {
    speciesId: 'ferryPike', placeId: RIVER_ID, weather: 'windy', times: ['day'], bandId: 'seam', minDistanceM: FERRY_PIKE_BAND.fromM, maxDistanceM: FERRY_PIKE_BAND.toM, where: 'Under the ferry rope, 18 to 26 m · windy · day',
  },
];

/** The ids of all the trophies, in board order (the lake's three, then the river's three). */
export const TROPHY_IDS: readonly string[] = RARE_RULES.map((r) => r.speciesId);

/** The trophies that live at a place, in board order. */
export const trophyIdsAt = (placeId: string): string[] => RARE_RULES.filter((r) => r.placeId === placeId).map((r) => r.speciesId);

/**
 * Where the half-hints come through (the hint text itself is `Species.logHint`):
 * the golden tench in a bottle note (data/moments.ts), Old Mossback from Pajkel (here), the silver ghost on the notice board
 * (which lists every hint still unknown as a "rumour").
 */
export const PAJKEL_HINT_LINES: Record<string, readonly string[]> = {
  mossback: [
    'They say an old carp, green as the shore, comes out of the fog...',
    'Old carp in the fog, far out. A sweet bite, they say.',
    'Fog and corn, far out. Just saying.',
  ],
  // The river's (slice 25f): Pajkel hints at the Barbel King; the Lantern's and the Ferry pike's hints come on the notice board and in a paper boat.
  barbelKing: [
    'W. told me about an old king in the bend pool. White whiskers, he said.',
    "The old barbel eats at dusk, when the sky can't make up its mind.",
    'Overcast, dusk, the deep bend. And something that smells of fish.',
  ],
  ferryPike: [
    'Hear the rope? Something hunts under it when the wind shakes it.',
    'A pike under the ferry rope. Windy day, any bait, right under it.',
  ],
};

/** Which place Pajkel's idle hints belong to: each place hints at the one trophy he has a line for (until it is caught). */
export const PAJKEL_HINT_FISH: Record<string, readonly string[]> = { [LAKE_ID]: ['mossback'], [RIVER_ID]: ['barbelKing', 'ferryPike'] };

/**
 * The river's bottle note (slice 25f): the River bend has no bottle moment, so a paper boat that holds no worms may carry a folded hint
 * about a trophy not caught yet instead. Chance per such boat, and the card's title.
 */
export const BOAT_NOTE = { chance: 0.5, title: 'Paper boat note' };

/** Pajkel says a hint line now and then while idle: real ms between lines, shorter on the day with the matching weather. */
export const HINT_GAP_MS = { normal: { min: 150_000, max: 330_000 }, matching: { min: 50_000, max: 120_000 } };

export const TROPHY_TEXT = {
  firstLine: 'Mounted on the trophy board!',
  /** Pajkel's line at the first catch of each trophy (one bubble, wraps to two lines). */
  pajkelFirst: {
    goldenTench: 'A golden tench! It is real!',
    mossback: 'Old Mossback! I never believed it.',
    silverGhost: 'A silver ghost! Unreal, {player}.',
    lantern: 'The Lantern! The river lit up!',
    barbelKing: 'The Barbel King! Look at that moustache!',
    ferryPike: 'The ferry pike! It is real!',
  } as Record<string, string>,
  /** Said when a later catch of the same trophy is not bigger than the one on the board. */
  backInLake: 'Back into {water} it goes',
  /** The river board's title (slice 25f): the lake's stays 'Trophy board'. */
  riverBoardTitle: 'River trophies',
  board: { title: 'Trophy board', empty: 'Nothing mounted yet.' },
};

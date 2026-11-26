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

export const RARE_RULES: readonly RareRule[] = [
  {
    speciesId: 'goldenTench', weather: 'rain', times: ['dawn', 'dusk'], zone: 'deep', where: 'Deep water · rain · dawn or dusk',
  },
  {
    speciesId: 'mossback', weather: 'fog', baitId: 'corn', minDistanceM: 30, where: 'Far water, 30 m or more · fog · corn',
  },
  {
    speciesId: 'silverGhost', weather: 'sunny', hours: { from: 11, to: 13 }, zone: 'shallow', baitId: 'maggots', where: 'Shallow water · sunny · 11:00 to 13:00 · maggots',
  },
];

/** The ids of the three trophies, in board order. */
export const TROPHY_IDS: readonly string[] = RARE_RULES.map((r) => r.speciesId);

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
};

/** Pajkel says a hint line now and then while idle: real ms between lines, shorter on the day with the matching weather. */
export const HINT_GAP_MS = { normal: { min: 150_000, max: 330_000 }, matching: { min: 50_000, max: 120_000 } };

export const TROPHY_TEXT = {
  firstLine: 'Mounted on the trophy board!',
  /** Pajkel's line at the first catch of each trophy (one bubble, wraps to two lines). */
  pajkelFirst: {
    goldenTench: 'A golden tench! It is real!',
    mossback: 'Old Mossback! I never believed it.',
    silverGhost: 'A silver ghost! Unreal, {player}.',
  } as Record<string, string>,
  /** Said when a later catch of the same trophy is not bigger than the one on the board. */
  backInLake: 'Back into {water} it goes',
  board: { title: 'Trophy board', empty: 'Nothing mounted yet.' },
};

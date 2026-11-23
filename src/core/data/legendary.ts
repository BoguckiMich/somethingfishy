/**
 * Tunables of the legendary fish "The Pale One" (GAME_DESIGN section 3, slice 12) and of the eerie
 * window around it. Logic lives in core/legendary.ts and core/eerie.ts.
 */
export const PALE_ONE = {
  speciesId: 'pale',
  /** The bobber must land at least this far out (in practice: the carbon rod only). */
  minDistanceM: 30,
  /** The in-game clock window, in hours: from (inclusive) to (exclusive). */
  fromHour: 2,
  toHour: 4,
  /** Chance per landed cast, inside the window and far enough out, that it replaces the normal pick. */
  chance: 0.25,
  /** How long its show-off lasts (real ms); longer than the new-species one. */
  showOffMs: 10_000,
};

/** The window ambience (still lake, green tint, quiet crickets), by eerie level 0 / 1 / 2. */
export const EERIE_TUNING = {
  /** Green overlay strength on the water (alpha). */
  tint: [0, 0.22, 0.5] as const,
  /** How still the water is, 0..1. */
  calm: [0, 1, 1] as const,
  /** Cricket gain factor inside the window (level 1). */
  windowCrickets: 0.25,
  /** Drone gain (level 2 only). */
  drone: [0, 0, 1] as const,
};

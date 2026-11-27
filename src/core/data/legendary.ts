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

/**
 * The legendary "The Ferryman" of the River bend (slice 25f, docs/RIVER_BEND.md section 5): a huge old sturgeon in the deep pool by the far
 * ferry post. It bites at dusk (the clock's dusk, 18:00 to 20:00) on a cast into the bend pool far enough out for the carbon rod only.
 * Logic in core/legendary.ts; the window's rope creak and slow current in core/eerie.ts.
 */
export const FERRYMAN = {
  speciesId: 'ferryman',
  placeId: 'river-bend',
  /** The band it lives in (a Zone.id of the River bend). */
  bandId: 'pool',
  /** The bobber must land at least this far out (the bend pool starts at 26 m; the fiberglass rod reaches exactly 26 m, so this is the carbon rod only). */
  minDistanceM: 30,
  /** The in-game clock window, in hours: from (inclusive) to (exclusive). The clock's dusk. */
  fromHour: 18,
  toHour: 20,
  chance: 0.25,
  showOffMs: 10_000,
};

/**
 * The Ferryman's window: while the clock is at dusk, now and then the ferry rope creaks by itself (a sound, and the rope sways a little
 * even without wind) and the current slows for a moment. Real-time cycle: `periodMs` between the starts of two creaks, the first one
 * `firstMs` after the window opens; each lasts `creakMs`, the current is down to `slowTo` of its speed at the middle of it.
 */
export const FERRY_WINDOW = {
  periodMs: 16_000,
  firstMs: 2_500,
  creakMs: 4_000,
  /** The current's speed factor at the deepest point of a creak (1 = normal). */
  slowTo: 0.12,
  /** The rope's extra sideways sway in px at the middle of a creak, and how many swings it makes in one. */
  swayPx: 9,
  swings: 2.5,
  /** The creak sound plays this far into a creak (ms), so the sway has started first. */
  soundAtMs: 250,
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

export interface Rod {
  id: string;
  name: string;
  /** Cast distance at full power, in meters. */
  maxCastM: number;
  /** Coins in the shop (the starter rod is free). */
  price: number;
  /** What this rod does to the catch bar. */
  barGear: BarGear;
}

/** What the player's gear does to the catch bar (GAME_DESIGN §3). 1 = the starter value. */
export interface BarGear {
  /** Rod: height of the catch zone as a fraction of the bar (0..1). */
  zoneSize: number;
  /** Reel: how eagerly the zone follows the thumb (scales both lift and gravity). */
  reelResponse: number;
  /** Line: how fast progress drains while the fish is outside the zone (1 = normal). */
  lineDrain: number;
  /** Bait: 0..1, calms the fish and shrinks its movements. */
  baitCalm: number;
}

/** A line upgrade (slice 15a): scales how fast catch-bar progress drains. */
export interface Line {
  id: string;
  name: string;
  price: number;
  /** Multiplies the rod's `lineDrain` (< 1 = easier). */
  drain: number;
  /** One line for the shop, e.g. "Progress drains 15% slower". */
  effect: string;
}

/** A reel upgrade (slice 15a): scales how eagerly the catch zone follows the thumb. */
export interface Reel {
  id: string;
  name: string;
  price: number;
  /** Multiplies the rod's `reelResponse` (> 1 = easier). */
  response: number;
  effect: string;
}

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

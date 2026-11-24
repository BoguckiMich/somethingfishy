/**
 * Tunables and note texts of the lake moments (GAME_DESIGN section 3, slice 14). The rules live in
 * core/moments/; the pictures in art/momentArt.ts and scenes/MomentsView.ts.
 */

export const MOMENT_KINDS = ['duck', 'frog', 'jump', 'star', 'bottle', 'bubbles', 'shape'] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

export interface MomentDef {
  /** Game-clock window in hours: from (inclusive) to (exclusive); `to` < `from` wraps past midnight. */
  fromHour: number;
  toHour: number;
  /** Relative chance among the moments whose window is open. */
  weight: number;
  /** Part of the eerie pair: only at night, quiets the crickets while on screen. */
  uncanny: boolean;
  /** How long it stays on screen if nobody taps it (real ms; the bottle lingers longer). */
  durationMs: number;
}

export const MOMENTS: Record<MomentKind, MomentDef> = {
  duck: { fromHour: 6, toHour: 19, weight: 4, uncanny: false, durationMs: 24_000 },
  frog: { fromHour: 18, toHour: 23, weight: 3, uncanny: false, durationMs: 22_000 },
  jump: { fromHour: 0, toHour: 24, weight: 4, uncanny: false, durationMs: 2_000 },
  star: { fromHour: 21, toHour: 4, weight: 2, uncanny: false, durationMs: 2_600 },
  bottle: { fromHour: 0, toHour: 24, weight: 2, uncanny: false, durationMs: 62_000 },
  bubbles: { fromHour: 1, toHour: 5, weight: 2.5, uncanny: true, durationMs: 12_000 },
  shape: { fromHour: 1, toHour: 5, weight: 2, uncanny: true, durationMs: 11_000 },
};

export const MOMENT_TUNING = {
  /** Real-time gap between moments: uniform in [minMs, maxMs] (mean 3 minutes). */
  gapMs: { min: 90_000, max: 270_000 },
  /** Coins a shooting star gives when tapped. */
  starCoins: { min: 5, max: 15 },
  /** A bottle holds worms with this chance (about 1 in 4), this many. */
  bottleWormChance: 0.25,
  bottleWorms: { min: 2, max: 5 },
  /** Cricket gain factor while an uncanny moment is on screen (eased by the ambient bed). */
  cricketDip: 0.2,
  /** A moment already on screen when a fight starts fades out this fast (real ms). */
  fadeOutMs: 400,
  /** A tap area is at least this big (game px, square), whatever the sprite size. */
  minTapPx: 40,
} as const;

export interface NoteDef {
  id: string;
  text: string;
  /** Only comes in a bottle between 22:00 and 05:00. */
  eerie?: boolean;
}

/** The bottle notes. Order never matters (they are shuffled), but ids must stay stable: they are saved. */
export const NOTES: readonly NoteDef[] = [
  { id: 'return-to-lake', text: 'If found, please return to the lake. — The Lake' },
  { id: 'worm-thief', text: 'Whoever keeps stealing my worms: I know it\'s you, duck.' },
  { id: 'perch-pike', text: 'The perch here are honest. The pike are not.' },
  { id: 'recipe', text: 'Recipe: one bream, one lemon, one patient friend.' },
  { id: 'old-carp', text: 'The old carp in the reeds is forty years old. Be nice to him.' },
  { id: 'gone-fishing', text: 'Gone fishing. Back never.' },
  { id: 'hello-somebody', text: 'I threw this in so somebody would read it. Hello, somebody!' },
  { id: 'tench-tip', text: 'Tip: the tench bite best when you stop staring at the bobber.' },
  { id: 'lost-bobber', text: 'Lost: one red bobber. Sentimental value. Reward: a nod.' },
  { id: 'raft', text: 'Day 3 on the raft. It is still a lake. I am still lost.' },
  { id: 'golden-tench', text: 'They say a golden tench rises in the rain, when the light is low.' },
  { id: 'warm-water', text: 'The water was warm tonight. It shouldn\'t be.', eerie: true },
  { id: 'extra-star', text: 'I counted the stars in the lake. There was one more than in the sky.', eerie: true },
];

/** Eerie notes come only inside this window of the game clock (hours, wraps past midnight). */
export const EERIE_NOTE_WINDOW = { fromHour: 22, toHour: 5 } as const;

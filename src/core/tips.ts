/**
 * Gentle hints (slice 22c), pure. The idle hint line picks ONE line by priority and is hidden when nothing
 * applies; the first-time glints say which things on the shore still wait for their first tap. The "seen"
 * flags live in `PlayerState.seen` (an optional list of ids, normalised on load, no version bump).
 */

/** Things on the shore that twinkle until they have been tapped once. */
export const GLINTS = ['car', 'sign', 'dog', 'crate', 'stones', 'bowl'] as const;
export type Glint = (typeof GLINTS)[number];

/** The idle hint says "Hold to charge" until this many casts were made. */
export const HINT_CASTS = 3;
const CAST_IDS = ['cast1', 'cast2', 'cast3'] as const;

/** The spinning rod's hint line ("Hold to reel...") shows for this many spin casts (slice 32), counted like the float casts. */
export const HINT_SPIN_CASTS = 3;
const SPIN_CAST_IDS = ['spin1', 'spin2', 'spin3'] as const;

/** Every id `seen` may hold: a glint tapped once, the n-th cast made, the river's eddy line (slice 25c) said, the river gear's first-cast lines (slice 25g), the n-th spin cast and Pajkel's line when the spinning rod was bought (slice 32). */
export const SEEN_IDS: readonly string[] = [...GLINTS, ...CAST_IDS, 'eddy', 'riverFloat', 'riverLead', ...SPIN_CAST_IDS, 'spinLine'];

/** How long the one-off lines (3 and later) stay up, and how often a glint twinkles. */
export const TIP_TUNING = { onceMs: 6000, glintEveryMs: 4000, glintMs: 900 } as const;

/** Anything saved -> a clean list: known ids only, no duplicates, in the canonical order. */
export function normalizeSeen(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return SEEN_IDS.filter((id) => v.includes(id));
}

export const isSeen = (seen: readonly string[] | undefined, id: string): boolean => (seen ?? []).includes(id);

/** Marks one id seen (unknown ids and repeats change nothing). */
export function markSeen(seen: readonly string[] | undefined, id: string): string[] {
  const cur = normalizeSeen(seen);
  return SEEN_IDS.includes(id) && !cur.includes(id) ? normalizeSeen([...cur, id]) : cur;
}

/** How many casts have been made (capped at HINT_CASTS). */
export const castCount = (seen: readonly string[] | undefined): number => CAST_IDS.filter((id) => isSeen(seen, id)).length;

/** One more cast made. */
export const markCast = (seen: readonly string[] | undefined): string[] => {
  const n = castCount(seen);
  return n >= HINT_CASTS ? normalizeSeen(seen) : markSeen(seen, CAST_IDS[n]);
};

/** How many spin casts have been made (capped at HINT_SPIN_CASTS). */
export const spinCastCount = (seen: readonly string[] | undefined): number => SPIN_CAST_IDS.filter((id) => isSeen(seen, id)).length;

/** One more spin cast made. */
export const markSpinCast = (seen: readonly string[] | undefined): string[] => {
  const n = spinCastCount(seen);
  return n >= HINT_SPIN_CASTS ? normalizeSeen(seen) : markSeen(seen, SPIN_CAST_IDS[n]);
};

/** Dev sandbox default: everything already seen, so other flags show a clean lake. */
export const allSeen = (): string[] => [...SEEN_IDS];

export type TipId = 'bait' | 'cast' | 'bagFull' | 'box' | 'quest' | 'story' | 'car';

export interface Tip {
  id: TipId;
  text: string;
  /** Lines 3 and later show for TIP_TUNING.onceMs once per occasion; lines 1 and 2 stay while true. */
  once: boolean;
}

export interface TipFacts {
  /** She can cast (some bait is chosen and left). */
  canCast: boolean;
  /** Bait of any kind left (worms or special). */
  baitTotal: number;
  seen: readonly string[] | undefined;
  bagFull: boolean;
  /** Today's bait box is waiting in the crate. */
  boxWaiting: boolean;
  /** A finished quest is waiting to be claimed. */
  questReady: boolean;
  /** Today's story chapter is waiting or out on the water. */
  storyWaiting: boolean;
}

/** Every line must fit the 360 px game in the HUD frame (about 10 px a letter): at most 33 letters. */
export const TIP_MAX_CHARS = 33;

/** The idle hint line, by priority; null when nothing applies (no line, no frame). */
export function pickTip(f: TipFacts): Tip | null {
  if (!f.canCast) {
    const text = f.baitTotal > 0 ? 'Out of worms, choose another bait' : 'Out of worms, visit the Shop';
    return { id: 'bait', text, once: false };
  }
  if (castCount(f.seen) < HINT_CASTS) return { id: 'cast', text: 'Hold to charge, release to cast', once: false };
  if (f.bagFull) return { id: 'bagFull', text: 'Bag is full: sell at the Shop', once: true };
  if (f.boxWaiting && !isSeen(f.seen, 'crate')) return { id: 'box', text: 'A package! Tap the crate', once: true };
  if (f.questReady) return { id: 'quest', text: 'A quest is done: see the board', once: true };
  if (f.storyWaiting) return { id: 'story', text: 'A new note on the notice board', once: true };
  // The car's road map was never found: the lowest of the one-off lines, after the first casts.
  if (!isSeen(f.seen, 'car')) return { id: 'car', text: 'Tap the car for the road map', once: true };
  return null;
}

/** Which of the shore things twinkle now: not tapped yet, and actually there (`present`). */
export function activeGlints(seen: readonly string[] | undefined, present: Partial<Record<Glint, boolean>>): Glint[] {
  return GLINTS.filter((g) => present[g] === true && !isSeen(seen, g));
}

/** A glint's twinkle phase 0..1 at `elapsedMs` (staggered per index), or -1 while resting: ~0.9 s of every 4 s. */
export function glintPhase(elapsedMs: number, index: number): number {
  const every = TIP_TUNING.glintEveryMs;
  const t = (((elapsedMs + (index * every) / 4) % every) + every) % every;
  return t < TIP_TUNING.glintMs ? t / TIP_TUNING.glintMs : -1;
}

export type SignAction = 'bottle' | 'chapter' | 'quests';

/**
 * What a tap on the notice-board sign does (only ever asked while she is idle): the sealed bottle's note
 * when it floats on the water, else today's chapter is started when it is waiting and the lake is calm,
 * else the daily quests.
 */
export function signAction(f: { bottleOnWater: boolean; chapterWaiting: boolean; calm: boolean }): SignAction {
  if (f.bottleOnWater) return 'bottle';
  if (f.chapterWaiting && f.calm) return 'chapter';
  return 'quests';
}

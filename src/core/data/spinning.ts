import type { Rod } from '../gear';
import { STARTER_BAR_GEAR } from './barGear';

/**
 * The spinning rod and its lures (slice 32, GAME_DESIGN "Spinning rod"). Sold at the River bend only (the shop's "River tackle"), works
 * everywhere once owned. All the numbers of the retrieve live here so they can be tuned with the bot sim (src/sim/spinning.sim.test.ts,
 * docs/ECONOMY_SIM.md "Spinning (32)"). Times are ms unless the name says S; depth is 0 (surface) .. 1 (bottom).
 */

/**
 * The spinning rod: 30 m reach, a flex between the fiberglass (zone 0.34) and the carbon rod (0.38), so the Line fight's red budget
 * (`lineGearOf`) sits between theirs. Line and reel are shared with the float rig (the session takes them from the equipped gear).
 */
export const SPIN_ROD_ID = 'spinrod';
export const SPIN_ROD: Rod = {
  id: SPIN_ROD_ID,
  name: 'Spinning Rod',
  maxCastM: 30,
  price: 2500,
  barGear: { ...STARTER_BAR_GEAR, zoneSize: 0.36, coreShare: 0.35 },
};

export type LureId = 'spinner' | 'wobbler' | 'jig';

export interface Lure {
  id: LureId;
  name: string;
  price: number;
  /** River checklist bundles that unlock it (0 = only the rod is needed). The gate itself lives in data/gearGates.ts. */
  bundles: number;
  /** One line for the shop. */
  effect: string;
  /** While reeling the lure runs at this depth (it rises or sinks to it) and moves this fast (depth per second). */
  reelDepth: number;
  reelDepthPerS: number;
  /** While paused it sinks this fast (depth per second) down to `pauseMax` (1 = it lies on the bottom, a wobbler hangs mid-water). */
  sinkPerS: number;
  pauseMax: number;
  /** A burst starts with a hop: the lure jumps up by this much (the soft jig hops off the bottom). */
  hop: number;
  /** How much each species likes it, a multiplier on the follow weight (missing = 1). A "favourite" is 2 or more. */
  likes: Readonly<Record<string, number>>;
  /** Extra multiplier in the deep bands (the bend pool: a jig is a perch's lure in the pool). */
  deepLikes?: Readonly<Record<string, number>>;
}

export const LURES: readonly Lure[] = [
  {
    id: 'spinner', name: 'Spinner', price: 300, bundles: 0, effect: 'Flashy and shallow: trout, perch and asp',
    reelDepth: 0.12, reelDepthPerS: 2, sinkPerS: 0.35, pauseMax: 1, hop: 0,
    likes: { trout: 3, perch: 3, asp: 3, chub: 0.8, pike: 0.8 },
  },
  {
    id: 'wobbler', name: 'Wobbler', price: 600, bundles: 2, effect: 'Swims at mid depth: chub, asp and trout',
    reelDepth: 0.45, reelDepthPerS: 1.2, sinkPerS: 0.1, pauseMax: 0.55, hop: 0,
    likes: { chub: 2, asp: 3, trout: 3, pike: 1.2, perch: 1 },
  },
  {
    id: 'jig', name: 'Soft jig', price: 450, bundles: 3, effect: 'Hops along the bottom: pike, and perch in the pool',
    reelDepth: 0.85, reelDepthPerS: 1, sinkPerS: 0.6, pauseMax: 1, hop: 0.3,
    likes: { pike: 3, perch: 1, chub: 0.5, trout: 0.4, asp: 0.4 },
    deepLikes: { perch: 2 },
  },
];

export const lureById = (id: string | undefined): Lure | undefined => LURES.find((l) => l.id === id);

/** The predators a lure can bring up (the fish in the pool by id): never a peaceful fish. */
export const PREDATORS: readonly string[] = ['pike', 'perch', 'asp', 'chub', 'trout'];

/** What one predator wants from the retrieve (the "rhythm preference" of the spec). */
export interface SpinSpecies {
  /** The depth it follows at (0..1) and how far from it the lure may be before the fish loses interest (depth units). */
  depth: number;
  tol: number;
  /** A burst longer than `burstMs[1]` bores it (the fast steady fish allow long ones, a perch wants twitches). */
  burstMs: readonly [number, number];
  /** A pause shorter than `pauseMs[0]` before a burst puts it off (the pike wants long pauses), and one longer than `pauseMs[1]` bores it. */
  pauseMs: readonly [number, number];
}

export const SPIN_SPECIES: Readonly<Record<string, SpinSpecies>> = {
  trout: { depth: 0.2, tol: 0.55, burstMs: [0, 5000], pauseMs: [0, 1200] },
  asp: { depth: 0.15, tol: 0.55, burstMs: [0, 5000], pauseMs: [0, 1200] },
  pike: { depth: 0.7, tol: 0.6, burstMs: [0, 1600], pauseMs: [1200, 5000] },
  perch: { depth: 0.5, tol: 0.6, burstMs: [0, 700], pauseMs: [200, 1500] },
  chub: { depth: 0.4, tol: 0.6, burstMs: [0, 2800], pauseMs: [400, 2500] },
  // The Ferry pike is a pike.
  ferryPike: { depth: 0.7, tol: 0.6, burstMs: [0, 1600], pauseMs: [1200, 5000] },
};

export const SPIN_TUNING = {
  /** The lure comes in this fast while the thumb is down (metres per second). */
  reelMps: 1.6,
  /** From this depth up the lure lies on the bottom. */
  bottomAt: 0.97,
  /** A follower must have followed this long before a strike is possible. */
  minFollowMs: 500,
  /** After a strike with the thumb up, the hook sets if the thumb goes down within this long (a miss is a nip). */
  hookGraceMs: 600,
  /** After a nip: the fish cools off (no strike for this long) and loses this much interest. */
  nipCooldownMs: 800,
  nipInterestLoss: 0.2,
  /** A follow roll every this much lure time; the chance of a follower per roll before the multipliers. */
  checkMs: 500,
  followChance: 0.14,
  /** Reference weight: a band whose suitable predators weigh this much (or more) gives the full chance. */
  presenceRef: 15,
  /** A follower starts with this interest (0..1); it leaves at 0, and may strike from `strikeInterestMin`. */
  startInterest: 0.55,
  strikeInterestMin: 0.5,
  /** The interest moves by (score - interestMid) x interestRate per second, score = rhythm x 0.6 + depth x 0.4 (both 0..1). */
  interestMid: 0.55,
  interestRate: 0.9,
  /** The strike hazard per second at full interest, and what the moment of the retrieve does to it. */
  strikeRate: 0.9,
  /** The pause just after a burst (this long) is the moment a predator strikes: x`afterBurstMul`; later in a pause x`laterPauseMul`; while reeling x`reelMul`. */
  afterBurstMs: 900,
  afterBurstMul: 3,
  laterPauseMul: 0.7,
  reelMul: 0.4,
  /** The length roll exponent is multiplied by this (below 1: bigger fish than the float rig brings). */
  sizeSkewMul: 0.45,
  /** The Ferry pike's chance (RARE_TUNING.chance) is multiplied by this for the soft jig. */
  jigFerryMul: 1.25,
  /** The lure must have lain on the bottom this long before the next reel-in can snag it. */
  snagArmMs: 3000,
  /** The snag chance of that one roll by band id (the river's riffle / seam / pool, the lake's shallow / deep); an unknown band uses its depth class. */
  snagPct: { riffle: 0.01, seam: 0.02, pool: 0.03, shallow: 0.01, deep: 0.03 } as Readonly<Record<string, number>>,
  /** A line that snapped loses the lure with this chance (else the fish spits it); 1 in this many lost ones is brought back by Bestia. */
  snapLoseChance: 0.85,
  bringBackOneIn: 5,
  /** River: how fast a paused lure's drift straightens out again while it is reeled (drift per second). */
  driftBackPerS: 0.2,
};

import type { TrophyState } from './rare';
import { speciesById, type Species } from './data/fish';
import { BAITS, WORM_ID, baitById, type Bait } from './data/baits';
import { RODS } from './data/rods';
import { NIGHT_KIT } from './data/nightKit';
import { LINES, REELS } from './data/tackle';
import { RARITY_PRICE_MULT, SHOP } from './data/shop';
import { FOTD_TUNING } from './data/fotd';
import type { GameEvent } from './events';
import { sizeShare, type HookedFish } from './fish';
import { newFishLog, type FishLog } from './fishLog';
import type { BarGear, Line, Reel, Rod } from './gear';
import type { Rng } from './random';
import { newDaily, type DailyState } from './daily/daily';
import { newQuests, questsOf, questsOnSale, type QuestsState } from './quests/quests';
import { newNotes, type NotesState } from './moments/moments';
import type { ChecklistState } from './checklist/checklist';
import type { StoryState } from './story/story';
import { gearUnlocked } from './gearGates';

/**
 * The player's belongings: coins, worms, the bag and the equipped rod. A plain serialisable
 * object (slice 9 will just save it). Everything here is pure: each function returns the new
 * state plus a result, and never mutates its input.
 */
export interface BagFish {
  speciesId: string;
  lengthCm: number;
  weightG: number;
  /** Coins when sold, fixed at catch time. */
  price: number;
  /** Caught perfectly (the fish never left the green zone, slice 23f): its tier is one higher. Stored only when true. The price stays by size. */
  perfect?: true;
}

export interface PlayerState {
  coins: number;
  worms: number;
  /** Special baits owned, by bait id (slice 15c); worms stay in `worms`. Missing = none. Read with baitCount(). */
  baits?: Record<string, number>;
  /** The bait she chose; missing or 'worm' = worms. Read with chosenBait(), which also handles a used-up choice. */
  baitId?: string;
  bag: BagFish[];
  rodId: string;
  /** The best line / reel owned (slice 15a); missing = none. Read with equippedLine() / equippedReel(). */
  lineId?: string;
  reelId?: string;
  /** The fish log: counts and records per species. */
  log: FishLog;
  /** The daily bait box (slice 13a); missing in older saves, read with dailyOf(). */
  daily?: DailyState;
  /** Today's three quests (slice 13b); missing in older saves, read with questsOf(). */
  quests?: QuestsState;
  /** Which bottle notes were read this round (slice 14); missing in older saves, read with notesOf(). */
  notes?: NotesState;
  /** Owns the night kit "Lantern & blanket" (slice 16); missing = no. */
  nightKit?: boolean;
  /** Filled slots per checklist bundle (slice 20); missing = nothing filled. Read with checklistOf(). */
  checklist?: ChecklistState;
  /** Story chapters seen, queued Pajkel lines and the Pale One beat (slice 21); missing = nothing yet. Read with storyOf(). */
  story?: StoryState;
  /** Hints seen (slice 22c): shore things tapped once and the first casts made (ids of core/tips); missing = nothing yet. */
  seen?: string[];
  /** The real date (YYYY-MM-DD) Pajkel last said the weather line (slice 23b); missing = never. */
  weatherSeen?: string;
  /** The trophy board (slice 23d): the biggest catch of each rare fish; missing = none caught yet. */
  trophies?: TrophyState;
  /** The camp items owned (slice 23e), ids of core/data/camp in shop order; missing = none. Read with campOwned(). */
  camp?: string[];
}

export function newPlayer(): PlayerState {
  return { coins: SHOP.startCoins, worms: SHOP.startWorms, bag: [], rodId: RODS[0].id, log: newFishLog(), daily: newDaily(), quests: newQuests(), notes: newNotes() };
}

export function equippedRod(p: PlayerState): Rod {
  return RODS.find((r) => r.id === p.rodId) ?? RODS[0];
}

// ---- Baits (slice 15c) ------------------------------------------------------------------------

/** How many of a bait she has (worms live in `worms`). */
export function baitCount(p: PlayerState, id: string): number {
  if (id === WORM_ID) return p.worms;
  return Math.max(0, Math.floor(p.baits?.[id] ?? 0));
}

/**
 * The bait that will really go on the hook: her choice while it has any left; else worms if any;
 * else the special bait she has most of (ties: data order); with nothing at all, worms (count 0).
 */
export function chosenBait(p: PlayerState): string {
  const id = p.baitId && (p.baitId === WORM_ID || baitById(p.baitId)) ? p.baitId : WORM_ID;
  if (baitCount(p, id) > 0) return id;
  if (p.worms > 0) return WORM_ID;
  let best: string = WORM_ID;
  let most = 0;
  for (const b of BAITS) {
    const n = baitCount(p, b.id);
    if (n > most) {
      best = b.id;
      most = n;
    }
  }
  return best;
}

/** Worms (always listed, even at 0), then every special bait she has any of, in shop order. */
export function ownedBaits(p: PlayerState): { id: string; count: number }[] {
  const out = [{ id: WORM_ID, count: p.worms }];
  for (const b of BAITS) if (baitCount(p, b.id) > 0) out.push({ id: b.id, count: baitCount(p, b.id) });
  return out;
}

/** All baits together, worms included (the soft-lock guard counts this). */
export const totalBait = (p: PlayerState): number => BAITS.reduce((sum, b) => sum + baitCount(p, b.id), p.worms);

/** Adds `n` of a special bait (worms: adds worms). Unknown ids and n <= 0 change nothing. */
export function addBait(p: PlayerState, id: string, n: number): PlayerState {
  if (n <= 0) return p;
  if (id === WORM_ID) return { ...p, worms: p.worms + n };
  if (!baitById(id)) return p;
  return { ...p, baits: { ...p.baits, [id]: baitCount(p, id) + n } };
}

/** Chooses a bait she has (worms always, even at 0); anything else is refused. */
export function chooseBait(p: PlayerState, id: string): { state: PlayerState; ok: boolean } {
  if (id !== WORM_ID && (!baitById(id) || baitCount(p, id) <= 0)) return { state: p, ok: false };
  return { state: { ...p, baitId: id }, ok: true };
}

/** Buys one shop pack of a bait. */
export function buyBait(state: PlayerState, id: string): Outcome {
  const bait: Bait | undefined = baitById(id);
  if (!bait?.pack) return fail(state, 'notSold');
  if (state.coins < bait.pack.price) return fail(state, 'needCoins', bait.pack.price - state.coins);
  return { ok: true, state: addBait({ ...state, coins: state.coins - bait.pack.price }, id, bait.pack.size) };
}

/** Can the player cast at all? Needs some of the chosen bait, or worms as the fallback. */
export function canCast(p: PlayerState): boolean {
  return baitCount(p, chosenBait(p)) > 0;
}

/** basePrice x rarity multiplier x (0.7 + position of the length in the species range), rounded. */
export function priceFor(species: Species, lengthCm: number): number {
  return Math.round(species.basePrice * RARITY_PRICE_MULT[species.rarity] * (SHOP.priceMin + SHOP.priceSpan * sizeShare(species, lengthCm)));
}

/** A caught fish as a bag entry; today's fish (slice 19) sells for double, fixed here at catch time. */
export function toBagFish(hooked: HookedFish, fotdId?: string, perfect = false): BagFish {
  const species = speciesById(hooked.speciesId)!;
  const mult = fotdId && hooked.speciesId === fotdId ? FOTD_TUNING.priceMult : 1;
  return { ...hooked, price: priceFor(species, hooked.lengthCm) * mult, ...(perfect ? { perfect: true as const } : {}) };
}

export const bagValue = (bag: BagFish[]): number => bag.reduce((sum, f) => sum + f.price, 0);

/** Index of the lowest-price fish (the first one on a tie), or -1 for an empty bag. */
export function cheapestIndex(bag: BagFish[]): number {
  let best = -1;
  bag.forEach((f, i) => {
    if (best < 0 || f.price < bag[best].price) best = i;
  });
  return best;
}

export type ShopError = 'needCoins' | 'bestRod' | 'bestLine' | 'bestReel' | 'badIndex' | 'emptyBag' | 'notSold' | 'needRod' | 'owned' | 'locked';
export type Outcome =
  | { state: PlayerState; ok: true }
  | { state: PlayerState; ok: false; error: ShopError; /** Coins still missing, for 'needCoins'. */ missing?: number };

const fail = (state: PlayerState, error: ShopError, missing?: number): Outcome => ({ state, ok: false, error, missing });

// ---- The bag ------------------------------------------------------------------------------

/** Puts a caught fish in the bag, or reports `bagFull` (state untouched) so the UI can ask. */
export function addCatch(
  state: PlayerState,
  hooked: HookedFish,
  fotdId?: string,
  perfect = false,
): { state: PlayerState; result: 'added' | 'bagFull'; fish: BagFish } {
  const fish = toBagFish(hooked, fotdId, perfect);
  if (state.bag.length >= SHOP.bagSlots) return { state, result: 'bagFull', fish };
  return { state: { ...state, bag: [...state.bag, fish] }, result: 'added', fish };
}

/** The player lets the new fish go: nothing changes. */
export function releasePending(state: PlayerState): PlayerState {
  return state;
}

/** Takes out the cheapest fish and puts the new one in its place. */
export function swapForCheapest(state: PlayerState, fish: BagFish): { state: PlayerState; removed: BagFish } {
  const i = cheapestIndex(state.bag);
  if (i < 0) return { state: { ...state, bag: [fish] }, removed: fish };
  const bag = state.bag.filter((_, j) => j !== i);
  return { state: { ...state, bag: [...bag, fish] }, removed: state.bag[i] };
}

// ---- The shop -----------------------------------------------------------------------------

/** Adds the coins of a sale to the sell-coins quests (a no-op without quests). */
function withSale(state: PlayerState, coins: number): PlayerState {
  if (!state.quests) return state;
  const r = questsOnSale(questsOf(state), coins);
  return r.quests === state.quests ? state : { ...state, quests: r.quests };
}

export function sellOne(state: PlayerState, index: number): Outcome {
  const fish = state.bag[index];
  if (!fish) return fail(state, 'badIndex');
  return { ok: true, state: withSale({ ...state, coins: state.coins + fish.price, bag: state.bag.filter((_, i) => i !== index) }, fish.price) };
}

export function sellAll(state: PlayerState): Outcome {
  if (state.bag.length === 0) return fail(state, 'emptyBag');
  return { ok: true, state: withSale({ ...state, coins: state.coins + bagValue(state.bag), bag: [] }, bagValue(state.bag)) };
}

export function buyWorms(state: PlayerState): Outcome {
  if (state.coins < SHOP.wormPackPrice) return fail(state, 'needCoins', SHOP.wormPackPrice - state.coins);
  return { ok: true, state: { ...state, coins: state.coins - SHOP.wormPackPrice, worms: state.worms + SHOP.wormPackSize } };
}

/** The next rod up from the equipped one, or undefined when the best is owned. */
export function nextRod(state: PlayerState): Rod | undefined {
  const i = RODS.findIndex((r) => r.id === state.rodId);
  return RODS[(i < 0 ? 0 : i) + 1];
}

/** Buys the next rod and equips it at once. */
export function buyRod(state: PlayerState): Outcome {
  const rod = nextRod(state);
  if (!rod) return fail(state, 'bestRod');
  if (!gearUnlocked(rod.id, state)) return fail(state, 'locked');
  if (state.coins < rod.price) return fail(state, 'needCoins', rod.price - state.coins);
  return { ok: true, state: { ...state, coins: state.coins - rod.price, rodId: rod.id } };
}

// ---- Lines and reels (slice 15a) ------------------------------------------------------------

/** The owned line (the best bought), or undefined for none. */
export const equippedLine = (p: PlayerState): Line | undefined => LINES.find((l) => l.id === p.lineId);
export const equippedReel = (p: PlayerState): Reel | undefined => REELS.find((r) => r.id === p.reelId);

/** The next line up from the owned one (the first when none), or undefined when the best is owned. */
export function nextLine(state: PlayerState): Line | undefined {
  return LINES[LINES.findIndex((l) => l.id === state.lineId) + 1];
}
export function nextReel(state: PlayerState): Reel | undefined {
  return REELS[REELS.findIndex((r) => r.id === state.reelId) + 1];
}

export function buyLine(state: PlayerState): Outcome {
  const line = nextLine(state);
  if (!line) return fail(state, 'bestLine');
  if (!gearUnlocked(line.id, state)) return fail(state, 'locked');
  if (state.coins < line.price) return fail(state, 'needCoins', line.price - state.coins);
  return { ok: true, state: { ...state, coins: state.coins - line.price, lineId: line.id } };
}

export function buyReel(state: PlayerState): Outcome {
  const reel = nextReel(state);
  if (!reel) return fail(state, 'bestReel');
  if (!gearUnlocked(reel.id, state)) return fail(state, 'locked');
  if (state.coins < reel.price) return fail(state, 'needCoins', reel.price - state.coins);
  return { ok: true, state: { ...state, coins: state.coins - reel.price, reelId: reel.id } };
}

// ---- The night kit (slice 16) ----------------------------------------------------------------

export const hasNightKit = (p: PlayerState): boolean => p.nightKit === true;

/** The shop shows the kit once the fiberglass rod, or a better one, is owned. */
export function nightKitForSale(p: PlayerState): boolean {
  const need = RODS.findIndex((r) => r.id === NIGHT_KIT.needsRodId);
  return RODS.findIndex((r) => r.id === p.rodId) >= need;
}

/** Buys "Lantern & blanket": once only, and only when the rod requirement is met. */
export function buyNightKit(state: PlayerState): Outcome {
  if (hasNightKit(state)) return fail(state, 'owned');
  if (!nightKitForSale(state)) return fail(state, 'needRod');
  if (state.coins < NIGHT_KIT.price) return fail(state, 'needCoins', NIGHT_KIT.price - state.coins);
  return { ok: true, state: { ...state, coins: state.coins - NIGHT_KIT.price, nightKit: true } };
}

/** What the catch bar really uses: the equipped rod's values with the line and reel multipliers on top. */
export function effectiveBarGear(state: PlayerState): BarGear {
  const rod = equippedRod(state).barGear;
  return {
    ...rod,
    lineDrain: rod.lineDrain * (equippedLine(state)?.drain ?? 1),
    reelResponse: rod.reelResponse * (equippedReel(state)?.response ?? 1),
  };
}

/**
 * Soft-lock guard: no worms, too few coins for a pack and nothing to sell means no way forward,
 * so the bait shop owner slips the player a few worms.
 */
export function freeWormsIfStuck(state: PlayerState): { state: PlayerState; granted: boolean } {
  const stuck = totalBait(state) === 0 && state.coins < SHOP.wormPackPrice && state.bag.length === 0;
  if (!stuck) return { state, granted: false };
  return { state: { ...state, worms: SHOP.freeWorms }, granted: true };
}

// ---- Worm use, driven by the session's events ----------------------------------------------

/**
 * Updates the player from a game event. A caught fish always uses the chosen bait (worm or special, slice 15c); a fish lost in the
 * fight uses it half the time (rolled through `rng`); scares and missed bites never cost one.
 */
export function applyEvent(state: PlayerState, event: GameEvent, rng: Rng): { state: PlayerState; wormUsed: boolean; baitUsed?: string } {
  const uses =
    event.type === 'fishCaught' || (event.type === 'fishLost' && rng() < SHOP.lostFightWormChance);
  const id = chosenBait(state);
  if (!uses || baitCount(state, id) <= 0) return { state, wormUsed: false };
  if (id === WORM_ID) return { state: { ...state, worms: state.worms - 1 }, wormUsed: true, baitUsed: id };
  const left = baitCount(state, id) - 1;
  const baits = { ...state.baits, [id]: left };
  // The last one is gone: the choice falls back to worms (chosenBait would do it anyway; this keeps the save tidy).
  const next: PlayerState = { ...state, baits };
  if (left <= 0) delete next.baitId;
  return { state: next, wormUsed: false, baitUsed: id };
}

/** The tab the shop opens on (slice 22b): Sell when the bag has fish, else Buy. */
export const shopStartTab = (p: PlayerState): 'sell' | 'buy' => (p.bag.length > 0 ? 'sell' : 'buy');

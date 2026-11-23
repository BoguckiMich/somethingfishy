import { speciesById, type Species } from './data/fish';
import { RODS } from './data/rods';
import { SHOP } from './data/shop';
import type { GameEvent } from './events';
import { sizeShare, type HookedFish } from './fish';
import { newFishLog, type FishLog } from './fishLog';
import type { Rod } from './gear';
import type { Rng } from './random';
import { newDaily, type DailyState } from './daily/daily';

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
}

export interface PlayerState {
  coins: number;
  worms: number;
  bag: BagFish[];
  rodId: string;
  /** The fish log: counts and records per species. */
  log: FishLog;
  /** The daily bait box (slice 13a); missing in older saves, read with dailyOf(). */
  daily?: DailyState;
}

export function newPlayer(): PlayerState {
  return { coins: SHOP.startCoins, worms: SHOP.startWorms, bag: [], rodId: RODS[0].id, log: newFishLog(), daily: newDaily() };
}

export function equippedRod(p: PlayerState): Rod {
  return RODS.find((r) => r.id === p.rodId) ?? RODS[0];
}

/** Can the player cast at all? (Out of worms: no.) */
export function canCast(p: PlayerState): boolean {
  return p.worms > 0;
}

/** basePrice x (0.5 + position of the length in the species range), rounded. */
export function priceFor(species: Species, lengthCm: number): number {
  return Math.round(species.basePrice * (SHOP.priceMin + SHOP.priceSpan * sizeShare(species, lengthCm)));
}

export function toBagFish(hooked: HookedFish): BagFish {
  const species = speciesById(hooked.speciesId)!;
  return { ...hooked, price: priceFor(species, hooked.lengthCm) };
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

export type ShopError = 'needCoins' | 'bestRod' | 'badIndex' | 'emptyBag';
export type Outcome =
  | { state: PlayerState; ok: true }
  | { state: PlayerState; ok: false; error: ShopError; /** Coins still missing, for 'needCoins'. */ missing?: number };

const fail = (state: PlayerState, error: ShopError, missing?: number): Outcome => ({ state, ok: false, error, missing });

// ---- The bag ------------------------------------------------------------------------------

/** Puts a caught fish in the bag, or reports `bagFull` (state untouched) so the UI can ask. */
export function addCatch(
  state: PlayerState,
  hooked: HookedFish,
): { state: PlayerState; result: 'added' | 'bagFull'; fish: BagFish } {
  const fish = toBagFish(hooked);
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

export function sellOne(state: PlayerState, index: number): Outcome {
  const fish = state.bag[index];
  if (!fish) return fail(state, 'badIndex');
  return { ok: true, state: { ...state, coins: state.coins + fish.price, bag: state.bag.filter((_, i) => i !== index) } };
}

export function sellAll(state: PlayerState): Outcome {
  if (state.bag.length === 0) return fail(state, 'emptyBag');
  return { ok: true, state: { ...state, coins: state.coins + bagValue(state.bag), bag: [] } };
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
  if (state.coins < rod.price) return fail(state, 'needCoins', rod.price - state.coins);
  return { ok: true, state: { ...state, coins: state.coins - rod.price, rodId: rod.id } };
}

/**
 * Soft-lock guard: no worms, too few coins for a pack and nothing to sell means no way forward,
 * so the bait shop owner slips the player a few worms.
 */
export function freeWormsIfStuck(state: PlayerState): { state: PlayerState; granted: boolean } {
  const stuck = state.worms === 0 && state.coins < SHOP.wormPackPrice && state.bag.length === 0;
  if (!stuck) return { state, granted: false };
  return { state: { ...state, worms: SHOP.freeWorms }, granted: true };
}

// ---- Worm use, driven by the session's events ----------------------------------------------

/**
 * Updates the player from a game event. A caught fish always uses the worm; a fish lost in the
 * fight uses it half the time (rolled through `rng`); scares and missed bites never cost one.
 */
export function applyEvent(state: PlayerState, event: GameEvent, rng: Rng): { state: PlayerState; wormUsed: boolean } {
  const uses =
    event.type === 'fishCaught' || (event.type === 'fishLost' && rng() < SHOP.lostFightWormChance);
  if (!uses || state.worms <= 0) return { state, wormUsed: false };
  return { state: { ...state, worms: state.worms - 1 }, wormUsed: true };
}

import { ALL_BUNDLES, CHECKLIST, PETROL_ID, checklistFor, type ChecklistBundle, type ChecklistSlot } from '../data/checklist';
import { isUnique, speciesById } from '../data/fish';
import { TIER_RANK, bagTier, isGoldOrBetter } from '../data/stars';
import type { BagFish, PlayerState } from '../inventory';
import { payReward, type QuestReward } from '../quests/quests';

/**
 * The Quiet Lake checklist (slice 20), pure. The saved state is, per bundle id, which slots are
 * filled. Missing = nothing filled. A fish handed in leaves the bag (no coins, no quest progress).
 */
export type ChecklistState = Record<string, boolean[]>;

export const bundleById = (id: string): ChecklistBundle | undefined => ALL_BUNDLES.find((b) => b.id === id);

/** The state with every bundle present and the right number of slots (garbage fixed, unknown ids dropped). */
export function normalizeChecklist(v: unknown): ChecklistState {
  const src = typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const out: ChecklistState = {};
  for (const b of ALL_BUNDLES) {
    const raw = Array.isArray(src[b.id]) ? (src[b.id] as unknown[]) : [];
    out[b.id] = b.slots.map((_, i) => raw[i] === true);
  }
  return out;
}

export const checklistOf = (p: PlayerState): ChecklistState => normalizeChecklist(p.checklist);

export const slotFilled = (p: PlayerState, bundleId: string, slot: number): boolean => checklistOf(p)[bundleId]?.[slot] === true;

export const bundleDone = (p: PlayerState, bundleId: string): boolean => {
  const filled = checklistOf(p)[bundleId];
  return !!filled && filled.length > 0 && filled.every(Boolean);
};

/** The bundles of a place's checklist (Quiet Lake's by default: the road, the story and the shop gates all count the lake). */
export const bundlesOf = (place?: string): readonly ChecklistBundle[] => checklistFor(place).bundles;
export const doneCount = (p: PlayerState, place?: string): number => bundlesOf(place).filter((b) => bundleDone(p, b.id)).length;
export const allDone = (p: PlayerState, place?: string): boolean => doneCount(p, place) === bundlesOf(place).length;
export const totalOf = (place?: string): number => bundlesOf(place).length;
/** The Quiet Lake total (the road to the river is fixed when all of these are done). */
export const bundleTotal = CHECKLIST.length;

/** Does this bag fish fill that slot? The Pale One never does; a coin slot takes no fish; a catch-tag slot wants a fish of the River bend that carries the tag. */
export function fits(slot: ChecklistSlot, fish: BagFish): boolean {
  const sp = speciesById(fish.speciesId);
  if (!sp || isUnique(sp)) return false;
  if (slot.kind === 'species') return fish.speciesId === slot.id;
  if (slot.kind === 'anyOf') return slot.ids.includes(fish.speciesId);
  if (slot.kind === 'star') return TIER_RANK[bagTier(fish)] >= TIER_RANK[slot.min];
  if (slot.kind === 'tag') return fish.river === true && (slot.tag === 'perfect' ? fish.perfect === true : fish[slot.tag] === true);
  return false;
}

/** Index of the cheapest fitting fish in the bag (first on a tie), or -1. */
export function cheapestFitting(bag: BagFish[], slot: ChecklistSlot): number {
  let best = -1;
  bag.forEach((f, i) => {
    if (fits(slot, f) && (best < 0 || f.price < bag[best].price)) best = i;
  });
  return best;
}

/** Open slots of this place's checklist this fish would fill. */
export function fittingSlots(p: PlayerState, fish: BagFish, place?: string): { bundleId: string; slot: number }[] {
  const state = checklistOf(p);
  const out: { bundleId: string; slot: number }[] = [];
  for (const b of bundlesOf(place)) {
    b.slots.forEach((s, i) => {
      if (!state[b.id][i] && fits(s, fish)) out.push({ bundleId: b.id, slot: i });
    });
  }
  return out;
}

export interface HandIn {
  player: PlayerState;
  ok: boolean;
  /** This hand-in finished the bundle (and paid its reward). */
  finished: boolean;
  reward: QuestReward | null;
}

const refused = (player: PlayerState): HandIn => ({ player, ok: false, finished: false, reward: null });

function fillSlot(p: PlayerState, bundle: ChecklistBundle, slot: number): HandIn {
  const state = checklistOf(p);
  const filled = state[bundle.id].map((f, i) => (i === slot ? true : f));
  let next: PlayerState = { ...p, checklist: { ...state, [bundle.id]: filled } };
  const finished = filled.every(Boolean);
  if (finished) next = payReward(next, bundle.reward);
  return { player: next, ok: true, finished, reward: finished ? bundle.reward : null };
}

/** Hands the cheapest fitting fish from the bag into an open fish slot. */
export function giveFish(p: PlayerState, bundleId: string, slot: number): HandIn {
  const bundle = bundleById(bundleId);
  const s = bundle?.slots[slot];
  if (!bundle || !s || s.kind === 'coins' || slotFilled(p, bundleId, slot)) return refused(p);
  const i = cheapestFitting(p.bag, s);
  if (i < 0) return refused(p);
  return fillSlot({ ...p, bag: p.bag.filter((_, j) => j !== i) }, bundle, slot);
}

/** Pays an open coin slot, when she has the coins. */
export function payCoins(p: PlayerState, bundleId: string, slot: number): HandIn {
  const bundle = bundleById(bundleId);
  const s = bundle?.slots[slot];
  if (!bundle || !s || s.kind !== 'coins' || slotFilled(p, bundleId, slot) || p.coins < s.amount) return refused(p);
  return fillSlot({ ...p, coins: p.coins - s.amount }, bundle, slot);
}

/** Can this open slot be filled right now (a fitting fish in the bag, or enough coins)? */
export function canFill(p: PlayerState, bundleId: string, slot: number): boolean {
  const s = bundleById(bundleId)?.slots[slot];
  if (!s || slotFilled(p, bundleId, slot)) return false;
  return s.kind === 'coins' ? p.coins >= s.amount : cheapestFitting(p.bag, s) >= 0;
}

/** Bundles in the order the panel lists them (slice 22b): unfinished ones in their own order, finished ones sink to the bottom. */
export function checklistOrder(p: PlayerState, place?: string): ChecklistBundle[] {
  const list = bundlesOf(place);
  return [...list.filter((b) => !bundleDone(p, b.id)), ...list.filter((b) => bundleDone(p, b.id))];
}

/** The bundle the panel opens first: the first one she can give something to now, else the first unfinished one, else none. */
export function firstOpenBundle(p: PlayerState, place?: string): string | undefined {
  const open = checklistOrder(p, place).filter((b) => !bundleDone(p, b.id));
  return (open.find((b) => b.slots.some((_, i) => canFill(p, b.id, i))) ?? open[0])?.id;
}

/** How many of a bundle's slots are filled. */
export const filledCount = (p: PlayerState, bundleId: string): number => (checklistOf(p)[bundleId] ?? []).filter(Boolean).length;

export interface GiveWarning {
  fish: BagFish;
  gold: boolean;
  fotd: boolean;
  /** "Gives your 33 cm perch, a gold fish" */
  text: string;
}

/** When Give would take a gold-star fish or the fish of the day (the cheapest fitting fish), says so; otherwise undefined. */
export function giveWarning(p: PlayerState, bundleId: string, slot: number, fotdId?: string): GiveWarning | undefined {
  const s = bundleById(bundleId)?.slots[slot];
  if (!s || s.kind === 'coins' || slotFilled(p, bundleId, slot)) return undefined;
  const i = cheapestFitting(p.bag, s);
  if (i < 0) return undefined;
  const fish = p.bag[i];
  const sp = speciesById(fish.speciesId);
  if (!sp) return undefined;
  const tier = bagTier(fish);
  const gold = isGoldOrBetter(tier);
  const fotd = fotdId !== undefined && fish.speciesId === fotdId;
  if (!gold && !fotd) return undefined;
  const goldWord = tier === 'medal' ? 'a medal fish' : 'a gold fish';
  const what = gold && fotd ? `${goldWord}, and the fish of the day` : gold ? goldWord : 'the fish of the day';
  return { fish, gold, fotd, text: `Gives your ${fish.lengthCm} cm ${sp.name.toLowerCase()}, ${what}` };
}

/** Why a slot's button is off ("not in bag", "need 120 more"), or undefined when it can be filled. */
export function slotBlockReason(p: PlayerState, bundleId: string, slot: number): string | undefined {
  const s = bundleById(bundleId)?.slots[slot];
  if (!s || slotFilled(p, bundleId, slot) || canFill(p, bundleId, slot)) return undefined;
  return s.kind === 'coins' ? `need ${s.amount - p.coins} more` : 'not in bag';
}

const BAIT_WORDS: Record<string, string> = { strip: 'fish strip', glow: 'glow bait', corn: 'corn', maggots: 'maggots' };

/** "+10 corn · +60 coins" style text for a reward ('' for none). */
export function checklistRewardText(r: QuestReward): string {
  const parts: string[] = [];
  if (r.bait) parts.push(`+${r.bait.n} ${BAIT_WORDS[r.bait.id] ?? r.bait.id}`);
  if (r.worms > 0) parts.push(`+${r.worms} worms`);
  if (r.coins > 0) parts.push(`+${r.coins} coins`);
  return parts.join(' · ');
}

/** The coin payment each place's dev flag leaves open (?cl=done): the petrol money at the lake, the ferry fare at the river. */
const PAYMENT_ID: Record<string, string> = { 'quiet-lake': PETROL_ID, 'river-bend': 'ferry-fare' };

/** Dev (?cl=done): every slot of the place's checklist filled except its payment (`includePayment` fills that too: ?cl=all). The other place's state is kept. */
export function allButPetrol(p: PlayerState, includePayment = false, place?: string): PlayerState {
  const state: ChecklistState = { ...checklistOf(p) };
  const pay = PAYMENT_ID[checklistFor(place).id];
  for (const b of bundlesOf(place)) state[b.id] = b.slots.map(() => includePayment || b.id !== pay);
  return { ...p, checklist: state };
}

/** Dev (?bundles=N): the first N bundles finished, the rest empty (shop gear gates, slice 23a). */
export function withBundlesDone(p: PlayerState, n: number, place?: string): PlayerState {
  const state: ChecklistState = { ...checklistOf(p) };
  bundlesOf(place).forEach((b, i) => {
    state[b.id] = b.slots.map(() => i < n);
  });
  return { ...p, checklist: state };
}

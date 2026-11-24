import { CHECKLIST, PETROL_ID, type ChecklistBundle, type ChecklistSlot } from '../data/checklist';
import { isLegendary, speciesById } from '../data/fish';
import { starFor, type Star } from '../data/stars';
import type { BagFish, PlayerState } from '../inventory';
import { payReward, type QuestReward } from '../quests/quests';

/**
 * The Quiet Lake checklist (slice 20), pure. The saved state is, per bundle id, which slots are
 * filled. Missing = nothing filled. A fish handed in leaves the bag (no coins, no quest progress).
 */
export type ChecklistState = Record<string, boolean[]>;

export const bundleById = (id: string): ChecklistBundle | undefined => CHECKLIST.find((b) => b.id === id);

/** The state with every bundle present and the right number of slots (garbage fixed, unknown ids dropped). */
export function normalizeChecklist(v: unknown): ChecklistState {
  const src = typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const out: ChecklistState = {};
  for (const b of CHECKLIST) {
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

export const doneCount = (p: PlayerState): number => CHECKLIST.filter((b) => bundleDone(p, b.id)).length;
export const allDone = (p: PlayerState): boolean => doneCount(p) === CHECKLIST.length;
export const bundleTotal = CHECKLIST.length;

const STAR_RANK: Record<Star, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };

/** Does this bag fish fill that slot? The Pale One never does; a coin slot takes no fish. */
export function fits(slot: ChecklistSlot, fish: BagFish): boolean {
  const sp = speciesById(fish.speciesId);
  if (!sp || isLegendary(sp)) return false;
  if (slot.kind === 'species') return fish.speciesId === slot.id;
  if (slot.kind === 'star') return STAR_RANK[starFor(sp, fish.lengthCm)] >= STAR_RANK[slot.min];
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

/** Open slots this fish would fill. */
export function fittingSlots(p: PlayerState, fish: BagFish): { bundleId: string; slot: number }[] {
  const state = checklistOf(p);
  const out: { bundleId: string; slot: number }[] = [];
  for (const b of CHECKLIST) {
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
export function checklistOrder(p: PlayerState): ChecklistBundle[] {
  return [...CHECKLIST.filter((b) => !bundleDone(p, b.id)), ...CHECKLIST.filter((b) => bundleDone(p, b.id))];
}

/** The bundle the panel opens first: the first one she can give something to now, else the first unfinished one, else none. */
export function firstOpenBundle(p: PlayerState): string | undefined {
  const open = checklistOrder(p).filter((b) => !bundleDone(p, b.id));
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
  const gold = starFor(sp, fish.lengthCm) === 'gold';
  const fotd = fotdId !== undefined && fish.speciesId === fotdId;
  if (!gold && !fotd) return undefined;
  const what = gold && fotd ? 'a gold fish, and the fish of the day' : gold ? 'a gold fish' : 'the fish of the day';
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

/** Dev (?cl=done): every slot filled except the petrol payment (`includePetrol` fills that too: ?cl=all). */
export function allButPetrol(p: PlayerState, includePetrol = false): PlayerState {
  const state: ChecklistState = {};
  for (const b of CHECKLIST) state[b.id] = b.slots.map(() => includePetrol || b.id !== PETROL_ID);
  return { ...p, checklist: state };
}

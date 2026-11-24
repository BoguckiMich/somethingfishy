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

const BAIT_WORDS: Record<string, string> = { strip: 'fish strip', glow: 'glow bait', corn: 'corn', maggots: 'maggots' };

/** "+10 corn · +60 coins" style text for a reward ('' for none). */
export function checklistRewardText(r: QuestReward): string {
  const parts: string[] = [];
  if (r.bait) parts.push(`+${r.bait.n} ${BAIT_WORDS[r.bait.id] ?? r.bait.id}`);
  if (r.worms > 0) parts.push(`+${r.worms} worms`);
  if (r.coins > 0) parts.push(`+${r.coins} coins`);
  return parts.join(' · ');
}

/** Dev (?cl=done): every slot filled except the petrol payment. */
export function allButPetrol(p: PlayerState): PlayerState {
  const state: ChecklistState = {};
  for (const b of CHECKLIST) state[b.id] = b.slots.map(() => b.id !== PETROL_ID);
  return { ...p, checklist: state };
}

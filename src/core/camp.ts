import { CAMP_IDS, campItemById, type CampId } from './data/camp';
import type { WeatherId } from './data/weather';
import type { Outcome, PlayerState } from './inventory';

/** The camp items she owns, in shop order (older saves have none). */
export const campOwned = (p: PlayerState): CampId[] => normalizeCamp(p.camp);

export const hasCamp = (p: PlayerState, id: string): boolean => campOwned(p).some((c) => c === id);

/** Anything saved -> a clean owned list: known ids only, no duplicates, in shop order. */
export function normalizeCamp(v: unknown): CampId[] {
  if (!Array.isArray(v)) return [];
  return CAMP_IDS.filter((id) => v.includes(id));
}

/** Buys a camp item for coins: once each, and only a known id. Touches nothing but the coins and the owned list. */
export function buyCampItem(state: PlayerState, id: string): Outcome {
  const item = campItemById(id);
  if (!item) return { state, ok: false, error: 'notSold' };
  if (hasCamp(state, id)) return { state, ok: false, error: 'owned' };
  if (state.coins < item.price) return { state, ok: false, error: 'needCoins', missing: item.price - state.coins };
  return { ok: true, state: { ...state, coins: state.coins - item.price, camp: normalizeCamp([...campOwned(state), id]) } };
}

/** Every camp item (dev flag ?camp=all). */
export const allCamp = (): CampId[] => [...CAMP_IDS];

/** How full the windsock is today: limp when sunny (and with no weather yet), full when windy, half blown out otherwise. */
export function windsockLevel(weather: WeatherId | undefined): 0 | 1 | 2 {
  if (!weather || weather === 'sunny') return 0;
  return weather === 'windy' ? 2 : 1;
}

/** What the campfire looks like (slice 27), by how hard it rains (0..1) and how deep the dusk / night glow is (0..1, the lantern ramp). */
export interface FireLook {
  /** Multiplies the glow rings and the core: rain dims it to about half. */
  glow: number;
  /** How far the flame sprite is darkened towards grey (0 = none): wet logs. */
  damp: number;
  /** Chance per frame tick that a flicker shows the small flame (frame 2) instead of the dancing ones: rain keeps the flame low. */
  lowFlame: number;
  /** Ms between two sparks (dry fire: a lively crackle, more at night; rain nearly puts them out). */
  sparkEveryMs: number;
  /** Ms between two puffs of smoke (0 = none): a little at dusk and night, a lot in rain, a thin wisp by day. */
  smokeEveryMs: number;
  /** How strongly the flames waver the glow (the lively flicker at dusk and night). */
  flicker: number;
}

export function campfireLook(rain: number, glow: number): FireLook {
  const r = Math.min(1, Math.max(0, rain));
  const g = Math.min(1, Math.max(0, glow));
  return {
    glow: 1 - 0.55 * r,
    damp: 0.4 * r,
    lowFlame: 0.75 * r,
    sparkEveryMs: Math.round((g > 0.02 ? 420 : 1600) * (1 + 3 * r)),
    smokeEveryMs: r > 0.05 ? Math.round(520 - 300 * r) : g > 0.02 ? 1500 : 3200,
    flicker: g > 0.02 ? 0.1 * (1 - 0.6 * r) : 0.04,
  };
}

/**
 * How warm the tent glows from inside (0..1): the dusk / night ramp, only when the tent is owned. A dim, even glow (no flicker: it is a
 * lantern, not a fire), a little softer in rain.
 */
export function tentGlow(owned: boolean, lanternGlowNow: number, rain: number): number {
  return owned ? Math.max(0, lanternGlowNow) * (1 - 0.2 * Math.min(1, Math.max(0, rain))) : 0;
}

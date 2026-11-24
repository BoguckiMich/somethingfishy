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

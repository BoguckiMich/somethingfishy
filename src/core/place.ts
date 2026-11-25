import { LOCATIONS, QUIET_LAKE, locationById } from './data/locations';
import type { Location } from './location';
import type { PlayerState } from './inventory';

/** Anything saved -> a known place id; unknown or missing is Quiet Lake. */
export function normalizePlace(v: unknown): string {
  return typeof v === 'string' && LOCATIONS.some((l) => l.id === v) ? v : QUIET_LAKE.id;
}

export const placeOf = (p: PlayerState): string => normalizePlace(p.place);
export const locationOf = (p: PlayerState): Location => locationById(placeOf(p));

/** The player, moved to a place (Quiet Lake is stored as no key, like a new game). */
export function withPlace(p: PlayerState, id: string): PlayerState {
  const place = normalizePlace(id);
  const { place: _old, ...rest } = p;
  return place === QUIET_LAKE.id ? rest : { ...rest, place };
}

/** Driving takes this long on the in-game clock. */
export const TRAVEL_MINUTES = 30;

/** Facts for "can she drive now": the scene reads its own state into these. */
export interface TravelFacts {
  fishing: string;
  panelOpen: boolean;
  fading: boolean;
  /** A show-off, a card, the road itself or a sleep sequence is running. */
  busy: boolean;
}

/** Travel only with Alex idle (no line in the water) and nothing else up. */
export const canTravel = (f: TravelFacts): boolean => f.fishing === 'idle' && !f.panelOpen && !f.fading && !f.busy;

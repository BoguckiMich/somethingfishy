import type { GameClock } from '../core/clock';
import type { PlayerState } from '../core/inventory';
import type { Profile } from '../core/profile';
import type { RoadCardHandle } from '../ui/roadCard';

/**
 * What a drive (or a place change by loading a save) hands to the next LakeScene (slice 25a): the scene is rebuilt for the new
 * place, so the game state travels here (a sandbox never saves, so it cannot be re-read from storage). Read once.
 */
export interface Handoff {
  player: PlayerState;
  clock: GameClock;
  /** The car arrives from the left and the screen clears from black (after a drive). */
  arrive: boolean;
  /** The road card that still covers the screen; the new scene removes it once it has drawn its first frame. */
  card?: RoadCardHandle;
  /** A toast for the new scene to show once it is set up ("Game loaded"). */
  toast?: string;
  /** The names to use (a loaded save's, or the sandbox's, which cannot re-read them from storage). */
  profile?: Profile;
}

let pending: Handoff | null = null;

export const setHandoff = (h: Handoff): void => {
  pending = h;
};

export function takeHandoff(): Handoff | null {
  const h = pending;
  pending = null;
  return h;
}

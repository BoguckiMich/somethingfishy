import { castDistance, chargePower } from './casting';
import type { Rod } from './gear';
import { zoneAt, type Location, type ZoneId } from './location';

/**
 * The float-fishing state machine. Pure: the scene sends events in and renders whatever
 * state comes out. Animations (cast arc, reel-in) are owned by the scene, which reports
 * their end with `landed` / `retrieved`.
 */
export type FishingState =
  | { kind: 'idle' }
  | { kind: 'charging'; heldMs: number }
  | { kind: 'casting'; power: number; distanceM: number; zone: ZoneId }
  | { kind: 'waiting'; distanceM: number; zone: ZoneId }
  | { kind: 'retrieving'; distanceM: number };

export type FishingEvent =
  | { type: 'press' }
  | { type: 'release' }
  | { type: 'tick'; dtMs: number }
  | { type: 'landed' }
  | { type: 'retrieved' };

export interface SessionContext {
  location: Location;
  rod: Rod;
}

export const INITIAL_STATE: FishingState = { kind: 'idle' };

export function step(state: FishingState, event: FishingEvent, ctx: SessionContext): FishingState {
  switch (state.kind) {
    case 'idle':
      return event.type === 'press' ? { kind: 'charging', heldMs: 0 } : state;

    case 'charging':
      if (event.type === 'tick') return { kind: 'charging', heldMs: state.heldMs + event.dtMs };
      if (event.type === 'release') {
        const power = chargePower(state.heldMs);
        const distanceM = castDistance(power, ctx.rod);
        return { kind: 'casting', power, distanceM, zone: zoneAt(ctx.location, distanceM).id };
      }
      return state;

    case 'casting':
      return event.type === 'landed'
        ? { kind: 'waiting', distanceM: state.distanceM, zone: state.zone }
        : state;

    case 'waiting':
      // For now a tap just reels the bobber back in. Bites arrive in slice 2.
      return event.type === 'press' ? { kind: 'retrieving', distanceM: state.distanceM } : state;

    case 'retrieving':
      return event.type === 'retrieved' ? INITIAL_STATE : state;
  }
}

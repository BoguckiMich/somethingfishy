import { formatCooldown } from './bedtime';
/**
 * The car is always tappable (fix/board-and-car). Pure rules: the scene reads its own state into these plain values.
 * Opening the road map is only a DOM panel over the scene, so it never interrupts fetch or the bedtime choreography.
 */

/** The fishing state kinds, as strings (core/fishingSession.ts `FishingState['kind']`). */
export type FishingKind = string;

/** The companions' mode (scenes/companions `Mode`) and the bed phase when it is 'bed'. */
export interface CarFacts {
  /** `state.kind` of the fishing session. */
  fishing: FishingKind;
  /** Another panel or card is open. */
  panelOpen: boolean;
  /** The sleep fade is running. */
  fading: boolean;
}

/**
 * A tap on the car opens the road map while Alex is idle or the bobber waits in the water (opening it does not reel in),
 * and nothing else is up: no fight, bite, cast, show-off, panel or fade.
 */
export function canOpenMap(f: CarFacts): boolean {
  return (f.fishing === 'idle' || f.fishing === 'waiting') && !f.panelOpen && !f.fading;
}

export interface NapFacts {
  fishing: FishingKind;
  /** Companions' mode: 'dock' | 'leaving' | 'play' | 'returning' | 'bed'. */
  mode: string;
  /** True when the bed phase is 'asleep' (they are inside the car). */
  asleepInCar: boolean;
  /** Real ms left of the short rest after the last nap (balance A2); missing or 0 = none. */
  cooldownLeftMs?: number;
}

export interface NapStatus {
  available: boolean;
  /** Short reason shown when it is not available ('' when it is). */
  reason: string;
}

/** A nap is possible only with Alex idle and both companions idle on the dock (the same rule as the nap card). */
export function napAvailable(f: NapFacts): NapStatus {
  if (f.mode === 'bed') return { available: false, reason: f.asleepInCar ? "They're already asleep" : "They're heading to the car" };
  if (f.mode !== 'dock') return { available: false, reason: '{companion} is busy playing' };
  if (f.fishing !== 'idle') return { available: false, reason: 'Reel in first' };
  if ((f.cooldownLeftMs ?? 0) > 0) return { available: false, reason: `Still waking up (${formatCooldown(f.cooldownLeftMs!)})` };
  return { available: true, reason: '' };
}

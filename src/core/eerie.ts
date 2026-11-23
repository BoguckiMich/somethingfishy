import type { AmbientMix } from './ambientMix';
import { EERIE_TUNING } from './data/legendary';
import { inPaleWindow } from './legendary';

/**
 * How eerie the lake is (pure): 0 normal, 1 the Pale One's window (02:00-04:00: still water, a slight
 * green tint, quiet crickets), 2 a fight with a legendary (stronger tint, all ambient gone, a low
 * drone). The scene and the sound only read this; neither decides anything itself.
 */
export type EerieLevel = 0 | 1 | 2;

export function eerieLevel(minute: number, fightingLegendary: boolean): EerieLevel {
  if (fightingLegendary) return 2;
  return inPaleWindow(minute) ? 1 : 0;
}

/** What the picture does at a level: green overlay alpha and how still the water is (0..1). */
export function eerieLook(level: EerieLevel): { tint: number; calm: number } {
  return { tint: EERIE_TUNING.tint[level], calm: EERIE_TUNING.calm[level] };
}

/** The ambient layers plus the drone. */
export type LayerMix = AmbientMix & { drone: number };

/** The time-of-day ambient mix reshaped for the eerie level. */
export function eerieMix(mix: AmbientMix, level: EerieLevel): LayerMix {
  if (level === 2) return { water: 0, birds: 0, frogs: 0, crickets: 0, drone: EERIE_TUNING.drone[2] };
  if (level === 1) return { ...mix, crickets: mix.crickets * EERIE_TUNING.windowCrickets, drone: EERIE_TUNING.drone[1] };
  return { ...mix, drone: EERIE_TUNING.drone[0] };
}

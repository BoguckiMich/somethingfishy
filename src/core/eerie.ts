import type { AmbientMix } from './ambientMix';
import { EERIE_TUNING } from './data/legendary';
import { FERRY_WINDOW, FERRYMAN } from './data/legendary';
import { inFerrymanWindow, inPaleWindow } from './legendary';

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

/**
 * The Ferryman's window (slice 25f, pure): at the River bend, while the clock is at dusk, every `periodMs` the ferry rope creaks by itself
 * for `creakMs` and the current slows for a moment. `sinceMs` is the real time since the window opened (the scene counts it while the
 * clock is in the window and resets it to 0 outside). Returns how far into a creak it is.
 */
export interface FerryCreak {
  /** 0 = no creak, else the creak's progress 0..1 (it eases in and out: sin of the progress). */
  progress: number;
  /** The current's speed factor, 1 = normal, FERRY_WINDOW.slowTo at the middle of a creak. */
  current: number;
  /** The rope's extra sway in px (a damped swing, zero outside a creak). */
  sway: number;
  /** Which creak of the window this is (0 = the first, -1 = none yet); the scene plays the sound once per index, when `soundDue`. */
  index: number;
  /** True from `soundAtMs` into a creak until its end. */
  soundDue: boolean;
}

export function ferryCreak(sinceMs: number): FerryCreak {
  const none: FerryCreak = { progress: 0, current: 1, sway: 0, index: -1, soundDue: false };
  const t = sinceMs - FERRY_WINDOW.firstMs;
  if (!(t >= 0)) return none;
  const into = t % FERRY_WINDOW.periodMs;
  if (into >= FERRY_WINDOW.creakMs) return none;
  const progress = into / FERRY_WINDOW.creakMs;
  const bell = Math.sin(Math.PI * progress);
  return {
    progress,
    current: 1 - (1 - FERRY_WINDOW.slowTo) * bell,
    sway: FERRY_WINDOW.swayPx * bell * Math.sin(2 * Math.PI * FERRY_WINDOW.swings * progress),
    index: Math.floor(t / FERRY_WINDOW.periodMs),
    soundDue: into >= FERRY_WINDOW.soundAtMs,
  };
}

/** Does the creak window apply now? Only at the River bend, while the clock is at dusk. */
export const ferryWindowOpen = (placeId: string, minute: number): boolean => placeId === FERRYMAN.placeId && inFerrymanWindow(minute);

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

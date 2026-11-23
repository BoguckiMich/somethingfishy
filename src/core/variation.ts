import type { Rng } from './random';

export interface Variation {
  /** Multiplies every frequency of the sound. */
  pitch: number;
  /** Multiplies the loudness. */
  volume: number;
}

/** A small random pitch and volume change (default +-5%) so repeated sounds do not feel robotic. */
export function vary(rng: Rng, spread = 0.05): Variation {
  const pitch = 1 - spread + rng() * 2 * spread;
  const volume = 1 - spread + rng() * 2 * spread;
  return { pitch, volume };
}

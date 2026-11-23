import { randRange, type Rng } from './random';

export type CallKind = 'birds' | 'frogs';

/** [min, max) gap between two calls of the layer, in ms. Always more than a second apart. */
export const CALL_DELAY_MS: Record<CallKind, readonly [number, number]> = {
  birds: [2500, 9000],
  frogs: [1800, 7000],
};

/** How long until the next bird or frog call: random, so the ambience never loops audibly. */
export function nextCallDelayMs(kind: CallKind, rng: Rng): number {
  const [lo, hi] = CALL_DELAY_MS[kind];
  return randRange(rng, lo, hi);
}

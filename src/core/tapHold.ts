import { MIN_HOLD_MS } from './casting';

/** Shore things where a short tap opens something but a hold still casts (the thumb often lands on them). */
export type ShoreObject = 'sign' | 'car' | 'crate' | 'chair';

/**
 * What a release means after a press (pure). A hold of at least MIN_HOLD_MS casts wherever the finger ends. A shorter
 * one is the object's action when the press started on an object and the finger is still on it, else a bare tap
 * (which casts nothing and shows the "hold to charge" hint).
 */
export type ReleaseOutcome = 'cast' | 'action' | 'tooShort';

export function resolveRelease(heldMs: number, startedOn: ShoreObject | null, endedOn: ShoreObject | null): ReleaseOutcome {
  if (heldMs >= MIN_HOLD_MS) return 'cast';
  return startedOn !== null && startedOn === endedOn ? 'action' : 'tooShort';
}

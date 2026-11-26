import { MIN_HOLD_MS } from './casting';

/** Shore things where a short tap opens something but a hold still casts (the thumb often lands on them). */
export type ShoreObject = 'sign' | 'car' | 'crate' | 'chair' | 'board' | 'bed';

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

/** How long a press on a shore object must stay down before it becomes a charge (A3: a tap never moves the rod). */
export const OBJECT_HOLD_MS = 350;

/**
 * What a press that started on a shore object is doing so far (pure). While the finger stays on the object and under
 * OBJECT_HOLD_MS it is 'pending': the rod has not moved and a release is the object's action. Held longer, or slid
 * off the object, it is 'charge': the charge starts then, from zero.
 */
export type ObjectPressOutcome = 'pending' | 'charge';

export function objectPressOutcome(heldMs: number, stillOn: boolean): ObjectPressOutcome {
  return stillOn && heldMs < OBJECT_HOLD_MS ? 'pending' : 'charge';
}

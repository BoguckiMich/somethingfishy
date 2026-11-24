/**
 * Toasts wait while the fish-fight bar is up (they would draw over it), pure. The scene queues what is
 * said during a fight and shows one at a time once the fight and the show-off are over.
 */
export const TOAST_QUEUE_MAX = 3;

/** Adds a line to the waiting ones: repeats are dropped, and the oldest goes when the queue is full. */
export function enqueueToast(pending: readonly string[], text: string): string[] {
  if (pending.includes(text)) return [...pending];
  return [...pending, text].slice(-TOAST_QUEUE_MAX);
}

/** The next line to show now, if any: not during the fight or the show-off, and not on top of one still showing. */
export function nextToast(
  pending: readonly string[],
  f: { fighting: boolean; caught: boolean; busy: boolean },
): { pending: string[]; show: string | null } {
  if (pending.length === 0 || f.fighting || f.caught || f.busy) return { pending: [...pending], show: null };
  return { pending: pending.slice(1), show: pending[0] };
}

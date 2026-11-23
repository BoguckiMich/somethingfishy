/** The accumulator value that makes the next reeling frame click at once. */
export const REEL_PRIMED = Infinity;

/**
 * Reel clicks while the player reels in (the catch bar is held): one click per `intervalMs` of
 * reeling, the first one immediately. Not reeling is silent and primes the next press.
 * At most one click per call, so a long frame never bursts.
 */
export function advanceReel(acc: number, dtMs: number, reeling: boolean, intervalMs = 95): { acc: number; clicks: number } {
  if (!reeling) return { acc: REEL_PRIMED, clicks: 0 };
  if (acc === REEL_PRIMED) return { acc: 0, clicks: 1 };
  const total = acc + dtMs;
  if (total >= intervalMs) return { acc: total % intervalMs, clicks: 1 };
  return { acc: total, clicks: 0 };
}

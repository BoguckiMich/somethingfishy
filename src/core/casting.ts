import type { Rod } from './gear';

/** Time for the power meter to go 0 → 1 (it then falls back to 0 and repeats). */
export const CHARGE_HALF_CYCLE_MS = 900;

/** Cast power never drops below this, so a quick tap still drops the bobber in the water. */
export const MIN_POWER = 0.1;

/**
 * Power (0..1) after holding for `heldMs`. Ping-pongs so releasing at the right moment is a skill:
 * 0 → 1 over one half cycle, then back down to 0, and so on.
 */
export function chargePower(heldMs: number, halfCycleMs = CHARGE_HALF_CYCLE_MS): number {
  const t = Math.max(0, heldMs) / halfCycleMs;
  const phase = t % 2;
  return phase <= 1 ? phase : 2 - phase;
}

/** Distance in meters the bobber lands at for a given power. */
export function castDistance(power: number, rod: Rod): number {
  const p = Math.min(1, Math.max(MIN_POWER, power));
  return p * rod.maxCastM;
}

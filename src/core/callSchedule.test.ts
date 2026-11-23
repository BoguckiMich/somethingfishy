import { describe, expect, it } from 'vitest';
import { CALL_DELAY_MS, nextCallDelayMs } from './callSchedule';
import { seededRng } from './random';

describe('nextCallDelayMs', () => {
  it('spans the configured range for each kind', () => {
    for (const kind of ['birds', 'frogs'] as const) {
      const [lo, hi] = CALL_DELAY_MS[kind];
      expect(nextCallDelayMs(kind, () => 0)).toBe(lo);
      expect(nextCallDelayMs(kind, () => 0.999999)).toBeLessThan(hi);
      expect(nextCallDelayMs(kind, () => 0.999999)).toBeGreaterThan(hi - 5);
    }
  });

  it('is random: different draws give different gaps, the same seed the same gaps', () => {
    const a = seededRng(9);
    const b = seededRng(9);
    const seqA = [0, 1, 2, 3].map(() => nextCallDelayMs('birds', a));
    const seqB = [0, 1, 2, 3].map(() => nextCallDelayMs('birds', b));
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBe(4);
  });

  it('never calls back to back', () => {
    const rng = seededRng(5);
    for (let i = 0; i < 300; i++) {
      expect(nextCallDelayMs('frogs', rng)).toBeGreaterThanOrEqual(1000);
      expect(nextCallDelayMs('birds', rng)).toBeGreaterThanOrEqual(1000);
    }
  });
});

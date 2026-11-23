import { describe, expect, it } from 'vitest';
import { seededRng } from './random';
import { vary } from './variation';

describe('vary', () => {
  it('stays within +-5% by default', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 500; i++) {
      const v = vary(rng);
      expect(v.pitch).toBeGreaterThanOrEqual(0.95);
      expect(v.pitch).toBeLessThan(1.05);
      expect(v.volume).toBeGreaterThanOrEqual(0.95);
      expect(v.volume).toBeLessThan(1.05);
    }
  });

  it('maps the rng range onto the spread', () => {
    expect(vary(() => 0)).toEqual({ pitch: 0.95, volume: 0.95 });
    expect(vary(() => 0.5)).toEqual({ pitch: 1, volume: 1 });
    expect(vary(() => 0.999999).pitch).toBeCloseTo(1.05, 4);
  });

  it('draws pitch and volume independently', () => {
    const seq = [0, 0.5];
    let i = 0;
    expect(vary(() => seq[i++])).toEqual({ pitch: 0.95, volume: 1 });
  });

  it('accepts another spread', () => {
    expect(vary(() => 0, 0.1).pitch).toBeCloseTo(0.9);
  });
});

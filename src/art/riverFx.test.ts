import { describe, expect, it } from 'vitest';
import { ropePixels, ropePoints } from './riverFx';

describe('ropePixels (perspective fix 2026-11-26)', () => {
  it('is 2 px near the post and 1 px at the far end, with no gaps', () => {
    const px = ropePixels(ropePoints(0));
    expect(px[0].size).toBe(2);
    expect(px[px.length - 1].size).toBe(1);
    for (let i = 1; i < px.length; i++) {
      expect(Math.abs(px[i].x - px[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(px[i].y - px[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });
});

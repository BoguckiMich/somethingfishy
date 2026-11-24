import { describe, expect, it } from 'vitest';
import { MOMENT_SPRITES, ringPoints } from './momentArt';
import { TRANSPARENT } from './pixelGrid';

describe('moment art', () => {
  it('every sprite has visible pixels', () => {
    for (const [name, s] of Object.entries(MOMENT_SPRITES)) {
      const opaque = Array.from(s.pixels).filter((p) => p !== TRANSPARENT).length;
      expect(opaque, name).toBeGreaterThan(10);
    }
  });
  it('the sprites have the intended (phone-readable) sizes', () => {
    const size = (k: string) => [MOMENT_SPRITES[k].width, MOMENT_SPRITES[k].height];
    expect(size('duck')).toEqual([21, 11]);
    expect(size('frogIdle')).toEqual([20, 8]);
    expect(size('frogPuff')).toEqual([20, 8]);
    expect(size('frogPad')).toEqual([20, 6]);
    expect(size('bottle')).toEqual([19, 9]);
    expect(size('jumpFish')).toEqual([21, 9]);
    expect(size('shape')).toEqual([40, 9]);
    expect(size('storyBottle')).toEqual([21, 9]);
    expect(size('sandwich')).toEqual([11, 7]);
    expect(size('footprint')).toEqual([7, 10]);
    expect(size('blinkOpen')).toEqual([9, 9]);
    expect(size('blinkHalf')).toEqual([9, 5]);
    expect(size('blinkShut')).toEqual([9, 3]);
  });
  it('a ring has no repeated pixels and spans the radii', () => {
    const pts = ringPoints(8, 3);
    expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(pts.length);
    expect(Math.max(...pts.map((p) => p.x))).toBe(8);
    expect(Math.min(...pts.map((p) => p.y))).toBe(-3);
  });
});

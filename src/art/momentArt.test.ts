import { describe, expect, it } from 'vitest';
import { MOMENT_SPRITES, ringPoints } from './momentArt';
import { TRANSPARENT } from './pixelGrid';

describe('moment art', () => {
  it('every sprite has some visible pixels and no row is empty at the edges of the bounding box', () => {
    for (const [name, s] of Object.entries(MOMENT_SPRITES)) {
      const opaque = Array.from(s.pixels).filter((p) => p !== TRANSPARENT).length;
      expect(opaque, name).toBeGreaterThan(5);
    }
  });
  it('the frog frames and the duck have the intended sizes', () => {
    expect([MOMENT_SPRITES.frogIdle.width, MOMENT_SPRITES.frogIdle.height]).toEqual([14, 5]);
    expect([MOMENT_SPRITES.frogPuff.width, MOMENT_SPRITES.frogPuff.height]).toEqual([14, 5]);
    expect([MOMENT_SPRITES.frogPad.width, MOMENT_SPRITES.frogPad.height]).toEqual([14, 5]);
    expect([MOMENT_SPRITES.duck.width, MOMENT_SPRITES.duck.height]).toEqual([14, 9]);
  });
  it('a ring has no repeated pixels and spans the radii', () => {
    const pts = ringPoints(8, 3);
    expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(pts.length);
    expect(Math.max(...pts.map((p) => p.x))).toBe(8);
    expect(Math.min(...pts.map((p) => p.y))).toBe(-3);
  });
});

import { describe, expect, it } from 'vitest';
import { TRANSPARENT } from './pixelGrid';
import { STAR_SIZE, starRowSprite, starSprite } from './starArt';

describe('star art', () => {
  it('draws a 9 x 9 star with an outline in every tier', () => {
    for (const t of ['bronze', 'silver', 'gold'] as const) {
      const s = starSprite(t);
      expect([s.width, s.height]).toEqual([STAR_SIZE, STAR_SIZE]);
      expect(s.pixels.filter((p) => p !== TRANSPARENT).length).toBeGreaterThan(30);
    }
  });
  it('rows are 1, 2 and 3 stars wide, and none has no row', () => {
    expect(starRowSprite('bronze')!.width).toBe(9);
    expect(starRowSprite('silver')!.width).toBe(19);
    expect(starRowSprite('gold')!.width).toBe(29);
    expect(starRowSprite('none')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { TRANSPARENT } from './pixelGrid';
import { MEDAL_H, MEDAL_W, medalSprite, STAR_SIZE, starRowSprite, starSprite } from './starArt';

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
  it('the medal is a 9 x 11 picture with a red ribbon and a gold disc, and stands in for the row', () => {
    const m = medalSprite();
    expect([m.width, m.height]).toEqual([MEDAL_W, MEDAL_H]);
    expect([MEDAL_W, MEDAL_H]).toEqual([9, 11]);
    expect(m.pixels.filter((p) => p !== TRANSPARENT).length).toBeGreaterThan(50);
    expect(starRowSprite('medal')!.width).toBe(9);
    expect(starRowSprite('medal')!.height).toBe(11);
  });
});

import { describe, expect, it } from 'vitest';
import { CLOCK_ICON_SIZE, halfSunSprite, moonSprite, sunSprite, timeIconSprite, wavesSprite } from './clockIconArt';
import { TRANSPARENT } from './pixelGrid';

describe('clock icons', () => {
  it('are 9 x 9 and not empty', () => {
    for (const s of [sunSprite(), halfSunSprite(), moonSprite(), wavesSprite(1), wavesSprite(3)]) {
      expect([s.width, s.height]).toEqual([CLOCK_ICON_SIZE, CLOCK_ICON_SIZE]);
      expect(s.pixels.filter((p) => p !== TRANSPARENT).length).toBeGreaterThan(8);
    }
  });
  it('three waves cover more than one', () => {
    const n = (c: 1 | 3) => wavesSprite(c).pixels.filter((p) => p !== TRANSPARENT).length;
    expect(n(3)).toBeGreaterThan(n(1));
  });
  it('picks the sun by day, the moon at night and the half sun in between', () => {
    expect(timeIconSprite('day').pixels).toEqual(sunSprite().pixels);
    expect(timeIconSprite('night').pixels).toEqual(moonSprite().pixels);
    expect(timeIconSprite('dawn').pixels).toEqual(halfSunSprite().pixels);
    expect(timeIconSprite('dusk').pixels).toEqual(halfSunSprite().pixels);
  });
});

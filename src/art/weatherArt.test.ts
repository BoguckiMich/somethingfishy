import { describe, expect, it } from 'vitest';
import { WEATHER_IDS } from '../core/data/weather';
import { TRANSPARENT } from './pixelGrid';
import { greyTowards, weatherLook, weatherSprite, WEATHER_ICON_SIZE } from './weatherArt';

describe('weather icons', () => {
  it('are 9 x 9, not empty, and all different', () => {
    const seen = new Set<string>();
    for (const id of WEATHER_IDS) {
      const s = weatherSprite(id);
      expect([s.width, s.height]).toEqual([WEATHER_ICON_SIZE, WEATHER_ICON_SIZE]);
      expect(s.pixels.filter((p) => p !== TRANSPARENT).length).toBeGreaterThan(8);
      seen.add(Array.from(s.pixels).join(','));
    }
    expect(seen.size).toBe(WEATHER_IDS.length);
  });
});

describe('weatherLook', () => {
  it('greys a colour toward its luminance', () => {
    expect(greyTowards(0x4080c0, 0)).toBe(0x4080c0);
    expect(greyTowards(0x808080, 0.5) & 255).toBeLessThan(0x80); // a little darker too
    const g = greyTowards(0xff0000, 1);
    expect((g >> 16) & 255).toBe((g >> 8) & 255);
    expect((g >> 8) & 255).toBe(g & 255);
  });
  it('leaves the look alone at 0', () => {
    const look = { skyTop: 1, skyBottom: 2, waterTint: 3, worldTint: 4, cloudTint: 5 };
    expect(weatherLook(look, 0)).toBe(look);
  });
});

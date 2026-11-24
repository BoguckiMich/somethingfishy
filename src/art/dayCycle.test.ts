import { describe, expect, it } from 'vitest';
import { cssColor, dayLook, KEYFRAMES, letterboxBands, lerpColor, moonArc, sunArc } from './dayCycle';

describe('dayLook', () => {
  it('hits every keyframe exactly', () => {
    for (const k of KEYFRAMES) {
      const { at, ...expected } = k;
      expect(dayLook(at)).toEqual(expected);
    }
  });

  it('interpolates halfway between keyframes', () => {
    const a = KEYFRAMES[3]; // 08:00
    const b = KEYFRAMES[4]; // 12:00
    const look = dayLook((a.at + b.at) / 2);
    expect(look.skyTop).toBe(lerpColor(a.skyTop, b.skyTop, 0.5));
    expect(look.skyBottom).toBe(lerpColor(a.skyBottom, b.skyBottom, 0.5));
  });

  it('interpolates per RGB channel', () => {
    expect(lerpColor(0x000000, 0xff8040, 0.5)).toBe(0x804020);
    expect(lerpColor(0x102030, 0x102030, 0.7)).toBe(0x102030);
  });

  it('wraps past midnight between 22:00 and 00:00', () => {
    const a = KEYFRAMES[KEYFRAMES.length - 1];
    const b = KEYFRAMES[0];
    expect(dayLook(23 * 60).skyTop).toBe(lerpColor(a.skyTop, b.skyTop, 0.5));
    expect(dayLook(24 * 60)).toEqual(dayLook(0));
    expect(dayLook(30 * 60)).toEqual(dayLook(6 * 60));
    expect(dayLook(-60)).toEqual(dayLook(23 * 60));
  });

  it('has stars only at night and a sun only by day', () => {
    expect(dayLook(12 * 60).starAlpha).toBe(0);
    expect(dayLook(23 * 60).starAlpha).toBeGreaterThan(0.9);
    expect(dayLook(12 * 60).sunAlpha).toBe(1);
    expect(dayLook(23 * 60).sunAlpha).toBe(0);
    expect(dayLook(23 * 60).moonAlpha).toBeGreaterThan(0.9);
  });
});

describe('celestial arcs', () => {
  it('sun is highest at midday and below the horizon at night', () => {
    expect(sunArc(12.25 * 60).height).toBeCloseTo(1, 1);
    expect(sunArc(12.25 * 60).up).toBe(true);
    expect(sunArc(23 * 60).up).toBe(false);
  });

  it('moon is up at midnight and moves left to right', () => {
    expect(moonArc(0).up).toBe(true);
    expect(moonArc(22 * 60).x).toBeLessThan(moonArc(3 * 60).x);
    expect(moonArc(12 * 60).up).toBe(false);
  });
});

describe('letterbox bands', () => {
  it('the top follows the sky top and the bottom the lawn', () => {
    const noon = letterboxBands(dayLook(12 * 60));
    expect(noon.top).toBe(dayLook(12 * 60).skyTop);
    expect(noon.bottom).toBeGreaterThan(0);
  });
  it('the lawn band darkens at night', () => {
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    expect(lum(letterboxBands(dayLook(0)).bottom)).toBeLessThan(lum(letterboxBands(dayLook(12 * 60)).bottom));
  });
  it('writes a CSS colour', () => {
    expect(cssColor(0x3a7436)).toBe('#3a7436');
    expect(cssColor(0x00ff0a)).toBe('#00ff0a');
  });
});

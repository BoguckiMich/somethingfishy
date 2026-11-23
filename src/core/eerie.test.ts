import { describe, expect, it } from 'vitest';
import { ambientMix } from './ambientMix';
import { eerieLevel, eerieLook, eerieMix } from './eerie';

const hm = (h: number, m = 0) => h * 60 + m;

describe('eerie level', () => {
  it('is 1 in the 02:00-04:00 window, 0 outside', () => {
    expect(eerieLevel(hm(1, 59), false)).toBe(0);
    expect(eerieLevel(hm(2), false)).toBe(1);
    expect(eerieLevel(hm(3, 59), false)).toBe(1);
    expect(eerieLevel(hm(4), false)).toBe(0);
    expect(eerieLevel(hm(12), false)).toBe(0);
  });

  it('is 2 while fighting a legendary, whatever the clock says', () => {
    expect(eerieLevel(hm(3), true)).toBe(2);
    expect(eerieLevel(hm(12), true)).toBe(2);
  });
});

describe('eerie look', () => {
  it('tints more and stays still from level 1, strongest in the fight', () => {
    expect(eerieLook(0)).toEqual({ tint: 0, calm: 0 });
    expect(eerieLook(1).calm).toBe(1);
    expect(eerieLook(1).tint).toBeGreaterThan(0);
    expect(eerieLook(2).tint).toBeGreaterThan(eerieLook(1).tint);
  });
});

describe('eerie mix', () => {
  const night = ambientMix(hm(3));
  it('level 0 changes nothing and has no drone', () => {
    expect(eerieMix(night, 0)).toEqual({ ...night, drone: 0 });
  });
  it('level 1 hushes the crickets only', () => {
    const m = eerieMix(night, 1);
    expect(night.crickets).toBeGreaterThan(0.5);
    expect(m.crickets).toBeLessThan(night.crickets * 0.5);
    expect(m.crickets).toBeGreaterThan(0);
    expect(m.water).toBe(night.water);
    expect(m.drone).toBe(0);
  });
  it('level 2 silences every ambient layer and brings the drone in', () => {
    expect(eerieMix(night, 2)).toEqual({ water: 0, birds: 0, frogs: 0, crickets: 0, drone: 1 });
    expect(eerieMix(ambientMix(hm(12)), 2).drone).toBe(1);
  });
});

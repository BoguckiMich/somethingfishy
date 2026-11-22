import { describe, expect, it } from 'vitest';
import { castDistance, chargePower, CHARGE_HALF_CYCLE_MS, MIN_POWER } from './casting';
import { RODS } from './data/rods';

const H = CHARGE_HALF_CYCLE_MS;
const starter = RODS[0];

describe('chargePower', () => {
  it('rises from 0 to 1 over one half cycle', () => {
    expect(chargePower(0)).toBe(0);
    expect(chargePower(H / 2)).toBeCloseTo(0.5);
    expect(chargePower(H)).toBeCloseTo(1);
  });

  it('falls back down after the peak and repeats', () => {
    expect(chargePower(H * 1.5)).toBeCloseTo(0.5);
    expect(chargePower(H * 2)).toBeCloseTo(0);
    expect(chargePower(H * 2.25)).toBeCloseTo(0.25);
  });

  it('treats negative time as zero', () => {
    expect(chargePower(-100)).toBe(0);
  });
});

describe('castDistance', () => {
  it('scales with power up to the rod max', () => {
    expect(castDistance(1, starter)).toBe(starter.maxCastM);
    expect(castDistance(0.5, starter)).toBe(starter.maxCastM / 2);
  });

  it('never goes below the minimum power', () => {
    expect(castDistance(0, starter)).toBe(MIN_POWER * starter.maxCastM);
  });
});

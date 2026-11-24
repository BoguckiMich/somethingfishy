import { describe, expect, it } from 'vitest';
import { castDistance, chargePower, CHARGE_HALF_CYCLE_MS, FULL_POWER_HOLD_MS, MIN_POWER } from './casting';
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
    const F = FULL_POWER_HOLD_MS;
    expect(chargePower(H + F + H / 2)).toBeCloseTo(0.5);
    expect(chargePower(2 * H + F)).toBeCloseTo(0);
    expect(chargePower(2 * H + F + H / 4)).toBeCloseTo(0.25);
  });

  it('holds at full power for the hold time, then continues falling', () => {
    const F = FULL_POWER_HOLD_MS;
    expect(chargePower(H)).toBe(1);
    expect(chargePower(H + F / 2)).toBe(1);
    expect(chargePower(H + F)).toBe(1);
    expect(chargePower(H + F + 1)).toBeLessThan(1);
    expect(chargePower(H + F + H / 2)).toBeCloseTo(0.5);
  });

  it('a release anywhere in the hold casts at max distance', () => {
    for (const x of [H, H + 100, H + FULL_POWER_HOLD_MS]) expect(castDistance(chargePower(x), starter)).toBe(starter.maxCastM);
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

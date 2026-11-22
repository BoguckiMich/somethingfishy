import { describe, expect, it } from 'vitest';
import { advanceClock, DAY_LENGTH_REAL_MS, daylight, formatClock, timeOfDay } from './clock';

describe('advanceClock', () => {
  it('a full real day-length advances exactly one in-game day', () => {
    expect(advanceClock({ day: 1, minute: 360 }, DAY_LENGTH_REAL_MS)).toEqual({ day: 2, minute: 360 });
  });

  it('wraps past midnight into the next day', () => {
    const c = advanceClock({ day: 1, minute: 1439 }, DAY_LENGTH_REAL_MS / 1440 * 2);
    expect(c.day).toBe(2);
    expect(c.minute).toBeCloseTo(1);
  });
});

describe('timeOfDay', () => {
  it.each([
    [0, 'night'], [5 * 60, 'dawn'], [6.9 * 60, 'dawn'], [7 * 60, 'day'],
    [17.9 * 60, 'day'], [18 * 60, 'dusk'], [20 * 60, 'night'], [23.9 * 60, 'night'],
  ] as const)('minute %d is %s', (minute, expected) => {
    expect(timeOfDay(minute)).toBe(expected);
  });
});

describe('daylight', () => {
  it('is 0 at night, 1 by day, and ramps through dawn and dusk', () => {
    expect(daylight(2 * 60)).toBe(0);
    expect(daylight(6 * 60)).toBeCloseTo(0.5);
    expect(daylight(12 * 60)).toBe(1);
    expect(daylight(19 * 60)).toBeCloseTo(0.5);
  });
});

it('formats the clock as HH:MM', () => {
  expect(formatClock(6 * 60 + 5.7)).toBe('06:05');
  expect(formatClock(23 * 60 + 59)).toBe('23:59');
});

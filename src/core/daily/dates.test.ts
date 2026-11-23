import { describe, expect, it } from 'vitest';
import { dayNumber, daysBetween, isValidDate } from './dates';

describe('isValidDate', () => {
  it('accepts real dates, including leap days', () => {
    expect(isValidDate('2026-11-23')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2000-02-29')).toBe(true);
  });
  it('rejects bad shapes and impossible dates', () => {
    for (const bad of ['2026-02-29', '1900-02-29', '2026-00-10', '2026-04-31', '2026-1-5', '26-11-23', '', '2026-11-23T00:00', null, 5]) {
      expect(isValidDate(bad)).toBe(false);
    }
  });
});

describe('daysBetween', () => {
  it('is 0 for the same day and signed for order', () => {
    expect(daysBetween('2026-11-23', '2026-11-23')).toBe(0);
    expect(daysBetween('2026-11-23', '2026-11-24')).toBe(1);
    expect(daysBetween('2026-11-24', '2026-11-23')).toBe(-1);
  });
  it('crosses month, year and leap boundaries', () => {
    expect(daysBetween('2026-11-30', '2026-12-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
  it('counts from the epoch', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('1969-12-31')).toBe(-1);
  });
  it('throws on an invalid date', () => {
    expect(() => dayNumber('nope')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { crossedBedtime, crossedCompanionBedtime, crossedWarning, inCarWindow, inWarnHour, loadClock, warningLines, inSleepWindow, lanternGlow, morningClock, napOptions, napWakeClock, nextOccurrence, wakeGreeting } from './bedtime';

describe('the sleep window', () => {
  it('runs from 02:00 up to, not including, 05:00', () => {
    expect(inSleepWindow(119.9)).toBe(false);
    expect(inSleepWindow(120)).toBe(true);
    expect(inSleepWindow(299.9)).toBe(true);
    expect(inSleepWindow(300)).toBe(false);
    expect(inSleepWindow(0)).toBe(false);
  });

  it('crossing 02:00 is spotted on the tick that passes it, and only then', () => {
    expect(crossedBedtime(119.99, 120.01)).toBe(true);
    expect(crossedBedtime(119.99, 119.995)).toBe(false);
    expect(crossedBedtime(120, 120.02)).toBe(false);
    // A jump (a nap, an import) is not a crossing.
    expect(crossedBedtime(60, 400)).toBe(false);
    // Midnight wrap: 23:59 -> 00:00 is not it either.
    expect(crossedBedtime(1439.9, 0.1)).toBe(false);
  });
});

describe('morningClock', () => {
  it('is 05:00 the same day after midnight, the next day before it', () => {
    expect(morningClock({ day: 2, minute: 125 })).toEqual({ day: 2, minute: 300 });
    expect(morningClock({ day: 2, minute: 23 * 60 })).toEqual({ day: 3, minute: 300 });
  });
});

describe('nextOccurrence', () => {
  it('is today when the time is still ahead', () => {
    expect(nextOccurrence({ day: 4, minute: 12 * 60 }, 18 * 60)).toEqual({ day: 4, minute: 18 * 60 });
  });
  it('is tomorrow when the time has passed', () => {
    expect(nextOccurrence({ day: 4, minute: 19 * 60 }, 18 * 60)).toEqual({ day: 5, minute: 18 * 60 });
  });
  it('is tomorrow when it is exactly that time (a nap always takes time)', () => {
    expect(nextOccurrence({ day: 4, minute: 7 * 60 }, 7 * 60)).toEqual({ day: 5, minute: 7 * 60 });
  });
  it('works across midnight: at 23:00, 05:00 is the next day', () => {
    expect(nextOccurrence({ day: 1, minute: 23 * 60 }, 5 * 60)).toEqual({ day: 2, minute: 5 * 60 });
  });
});

describe('the nap card', () => {
  it('offers dawn, day, dusk and night, plus deep night only with the kit', () => {
    expect(napOptions(false).map((o) => [o.label, o.minute])).toEqual([
      ['Dawn (05:00)', 300],
      ['Day (07:00)', 420],
      ['Dusk (18:00)', 1080],
      ['Night (20:00)', 1200],
    ]);
    expect(napOptions(true).map((o) => o.label)).toContain('Deep night (02:00)');
    expect(napOptions(true)).toHaveLength(5);
  });

  it('a nap ends at the chosen time (next day if it is past)', () => {
    expect(napWakeClock({ day: 1, minute: 12 * 60 }, 18 * 60, false)).toEqual({ day: 1, minute: 18 * 60 });
    expect(napWakeClock({ day: 1, minute: 12 * 60 }, 7 * 60, false)).toEqual({ day: 2, minute: 7 * 60 });
  });

  it('without the kit a nap never lands inside 02:00-05:00: they wake at 05:00', () => {
    expect(napWakeClock({ day: 1, minute: 23 * 60 }, 2 * 60, false)).toEqual({ day: 2, minute: 5 * 60 });
    expect(napWakeClock({ day: 1, minute: 23 * 60 }, 4 * 60, false)).toEqual({ day: 2, minute: 5 * 60 });
  });

  it('with the kit deep night is allowed', () => {
    expect(napWakeClock({ day: 1, minute: 23 * 60 }, 2 * 60, true)).toEqual({ day: 2, minute: 2 * 60 });
  });
});

describe('the companions go to the car at 00:00', () => {
  it('the car window runs from 00:00 up to, not including, 05:00', () => {
    expect(inCarWindow(0)).toBe(true);
    expect(inCarWindow(90)).toBe(true);
    expect(inCarWindow(299.9)).toBe(true);
    expect(inCarWindow(300)).toBe(false);
    expect(inCarWindow(23 * 60 + 59)).toBe(false);
  });

  it('midnight is spotted on the wrapping tick, and only then', () => {
    expect(crossedCompanionBedtime(1439.99, 0.01)).toBe(true);
    expect(crossedCompanionBedtime(1439.5, 1439.52)).toBe(false);
    expect(crossedCompanionBedtime(0.01, 0.03)).toBe(false);
    // A jump over the wrap (a nap, an import) is not a crossing.
    expect(crossedCompanionBedtime(1380, 200)).toBe(false);
    expect(crossedCompanionBedtime(600, 30)).toBe(false);
  });

  it('02:00 is not midnight, and midnight is not 02:00', () => {
    expect(crossedCompanionBedtime(119.99, 120.01)).toBe(false);
    expect(crossedBedtime(1439.99, 0.01)).toBe(false);
  });
});

describe('the 01:00 warning', () => {
  it('is spotted on the tick that passes 01:00, and only then', () => {
    expect(crossedWarning(59.99, 60.01)).toBe(true);
    expect(crossedWarning(60, 60.02)).toBe(false);
    expect(crossedWarning(30, 200)).toBe(false);
    expect(crossedWarning(1439.9, 0.1)).toBe(false);
  });

  it('a postponed warning is still due until 02:00', () => {
    expect(inWarnHour(59.9)).toBe(false);
    expect(inWarnHour(60)).toBe(true);
    expect(inWarnHour(119.9)).toBe(true);
    expect(inWarnHour(120)).toBe(false);
  });

  it('has a second line about the lantern only when the shop sells it to her', () => {
    expect(warningLines(false)).toEqual(['Bedtime at 02:00 - one more hour']);
    expect(warningLines(true)).toEqual(['Bedtime at 02:00 - one more hour', 'A lantern would let you stay up']);
  });
});

describe('loading a save in the night', () => {
  it('without the kit 02:00-05:00 wakes at 05:00; 00:00-02:00 stays as it is (companions in the car)', () => {
    expect(loadClock({ day: 3, minute: 3 * 60 }, false)).toEqual({ day: 3, minute: 300 });
    expect(loadClock({ day: 3, minute: 30 }, false)).toEqual({ day: 3, minute: 30 });
    expect(inCarWindow(30)).toBe(true);
  });
  it('with the kit the clock is never moved', () => {
    expect(loadClock({ day: 3, minute: 3 * 60 }, true)).toEqual({ day: 3, minute: 3 * 60 });
  });
});

describe('a nap that ends in the night', () => {
  it('with the kit, deep night lands inside the car window, so they stay in the car until 05:00', () => {
    const c = napWakeClock({ day: 1, minute: 23 * 60 }, 2 * 60, true);
    expect(c).toEqual({ day: 2, minute: 120 });
    expect(inCarWindow(c.minute)).toBe(true);
  });
  it('without the kit it goes to 05:00, outside the window', () => {
    expect(inCarWindow(napWakeClock({ day: 1, minute: 23 * 60 }, 2 * 60, false).minute)).toBe(false);
  });
});

describe('wakeGreeting', () => {
  it('fits the hour', () => {
    expect(wakeGreeting(300)).toBe('Good morning!');
    expect(wakeGreeting(420)).toBe('Good morning!');
    expect(wakeGreeting(18 * 60)).toBe('Good evening!');
    expect(wakeGreeting(20 * 60)).toBe('Good night!');
  });
});

describe('lanternGlow', () => {
  it('is off by day, ramps on from 20:00, is full late at night and eases out by 05:00', () => {
    expect(lanternGlow(12 * 60)).toBe(0);
    expect(lanternGlow(19 * 60 + 59)).toBe(0);
    expect(lanternGlow(20 * 60)).toBe(0);
    expect(lanternGlow(20 * 60 + 15)).toBeCloseTo(0.5);
    expect(lanternGlow(23 * 60)).toBe(1);
    expect(lanternGlow(3 * 60)).toBe(1);
    expect(lanternGlow(4 * 60 + 45)).toBeCloseTo(0.5);
    expect(lanternGlow(5 * 60)).toBe(0);
    expect(lanternGlow(6 * 60)).toBe(0);
  });
});

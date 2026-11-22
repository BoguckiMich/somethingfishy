/**
 * In-game clock. Accelerated: one in-game day passes in DAY_LENGTH_REAL_MS of play.
 * It only advances while the game is running, so closing the game pauses time.
 */
export const MINUTES_PER_DAY = 24 * 60;
export const DAY_LENGTH_REAL_MS = 20 * 60 * 1000;
const REAL_MS_PER_GAME_MINUTE = DAY_LENGTH_REAL_MS / MINUTES_PER_DAY;

export interface GameClock {
  /** Day counter, starting at 1. */
  day: number;
  /** Minute of the day, 0 ≤ minute < 1440 (fractional). */
  minute: number;
}

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** Start of each period, in hours. Night wraps past midnight. */
export const TIME_OF_DAY_STARTS: Record<TimeOfDay, number> = { dawn: 5, day: 7, dusk: 18, night: 20 };

export const NEW_GAME_CLOCK: GameClock = { day: 1, minute: 6 * 60 };

export function advanceClock(clock: GameClock, realDtMs: number): GameClock {
  const total = clock.minute + realDtMs / REAL_MS_PER_GAME_MINUTE;
  const days = Math.floor(total / MINUTES_PER_DAY);
  return { day: clock.day + days, minute: total - days * MINUTES_PER_DAY };
}

export function timeOfDay(minute: number): TimeOfDay {
  const h = minute / 60;
  const s = TIME_OF_DAY_STARTS;
  if (h >= s.dawn && h < s.day) return 'dawn';
  if (h >= s.day && h < s.dusk) return 'day';
  if (h >= s.dusk && h < s.night) return 'dusk';
  return 'night';
}

/**
 * How bright it is, 0 (deep night) .. 1 (full day). Ramps linearly through dawn and dusk.
 * The scene uses it for tinting; fish rules should use `timeOfDay` instead.
 */
export function daylight(minute: number): number {
  const h = minute / 60;
  const s = TIME_OF_DAY_STARTS;
  if (h >= s.day && h < s.dusk) return 1;
  if (h >= s.dawn && h < s.day) return (h - s.dawn) / (s.day - s.dawn);
  if (h >= s.dusk && h < s.night) return 1 - (h - s.dusk) / (s.night - s.dusk);
  return 0;
}

/** "06:05" */
export function formatClock(minute: number): string {
  const m = Math.floor(minute);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

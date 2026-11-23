import { MINUTES_PER_DAY, TIME_OF_DAY_NAMES, TIME_OF_DAY_STARTS, timeOfDay, type GameClock } from './clock';

/**
 * Bedtime, naps and the lantern (GAME_DESIGN section 3, slice 16). Pure: the scene asks these
 * questions of the game clock; the choreography of Pajkel and Bestia is in scenes/companions.
 */

/** Pajkel gets sleepy at 02:00 and everyone is up again at 05:00 (minutes of the day). */
export const BEDTIME_MINUTE = 2 * 60;
export const WAKE_MINUTE = 5 * 60;

/** True from 02:00 up to (not including) 05:00: the hours Pajkel and Bestia sleep in the car. */
export function inSleepWindow(minute: number): boolean {
  return minute >= BEDTIME_MINUTE && minute < WAKE_MINUTE;
}

/**
 * The clock just ran from `prev` to `now` within one tick: did it pass 02:00? A big step
 * (a clock jump, a nap) is never a crossing; callers also reset `prev` after jumping the clock.
 */
export function crossedBedtime(prev: number, now: number): boolean {
  return prev < BEDTIME_MINUTE && now >= BEDTIME_MINUTE && now - prev < 30;
}

/** Morning after a night's sleep: 05:00, one day on (the spec: "05:00 the next day"). */
export function morningClock(clock: GameClock): GameClock {
  return { day: clock.day + 1, minute: WAKE_MINUTE };
}

/** The next time the clock shows `minuteOfDay` (strictly later than now: tomorrow if it is that time or past it). */
export function nextOccurrence(clock: GameClock, minuteOfDay: number): GameClock {
  return clock.minute < minuteOfDay ? { day: clock.day, minute: minuteOfDay } : { day: clock.day + 1, minute: minuteOfDay };
}

export interface NapOption {
  id: string;
  label: string;
  /** Minute of the day the nap lasts until. */
  minute: number;
}

const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const napOf = (id: 'dawn' | 'day' | 'dusk' | 'night'): NapOption => ({
  id,
  label: `${TIME_OF_DAY_NAMES[id]} (${hhmm(TIME_OF_DAY_STARTS[id] * 60)})`,
  minute: TIME_OF_DAY_STARTS[id] * 60,
});

/** The buttons of the nap card, in order; "Deep night" is only for the night kit. */
export function napOptions(kit: boolean): NapOption[] {
  const list = [napOf('dawn'), napOf('day'), napOf('dusk'), napOf('night')];
  if (kit) list.push({ id: 'deep', label: `Deep night (${hhmm(BEDTIME_MINUTE)})`, minute: BEDTIME_MINUTE });
  return list;
}

/**
 * Where a nap until `minuteOfDay` ends. Without the kit it never lands between 02:00 and 05:00
 * (the nap counts as sleeping): then everyone wakes at 05:00.
 */
export function napWakeClock(clock: GameClock, minuteOfDay: number, kit: boolean): GameClock {
  const c = nextOccurrence(clock, minuteOfDay);
  return !kit && inSleepWindow(c.minute) ? { day: c.day, minute: WAKE_MINUTE } : c;
}

/** What the screen says when they wake up at this time of day. */
export function wakeGreeting(minute: number): string {
  const t = timeOfDay(((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  return t === 'dawn' || t === 'day' ? 'Good morning!' : t === 'dusk' ? 'Good evening!' : 'Good night!';
}

/** How lit the lantern is: 0 by day, ramping up over half an hour from 20:00, full all night, easing out until 05:00. */
export function lanternGlow(minute: number): number {
  const on = 20 * 60;
  const ramp = 30;
  if (minute >= on) return Math.min(1, (minute - on) / ramp);
  if (minute < WAKE_MINUTE) return Math.min(1, (WAKE_MINUTE - minute) / ramp);
  return 0;
}

import { MINUTES_PER_DAY, TIME_OF_DAY_NAMES, TIME_OF_DAY_STARTS, timeOfDay, type GameClock } from './clock';

/**
 * Bedtime, naps and the lantern (GAME_DESIGN section 3, slice 16). Pure: the scene asks these
 * questions of the game clock; the choreography of Pajkel and Bestia is in scenes/companions.
 */

/**
 * Two bedtimes (GAME_DESIGN section 3, slice 16, changed after the phone test): Pajkel and Bestia
 * go to the car at 00:00 (everyone, kit or not); Alex herself gets sleepy at 02:00, and only
 * without the night kit. 01:00 is the warning. Everyone is up again at 05:00 (minutes of the day).
 */
export const COMPANION_BEDTIME_MINUTE = 0;
export const WARN_MINUTE = 60;
export const BEDTIME_MINUTE = 2 * 60;
export const WAKE_MINUTE = 5 * 60;

/** True from 00:00 up to (not including) 05:00: the hours Pajkel and Bestia sleep in the car. */
export function inCarWindow(minute: number): boolean {
  return minute >= COMPANION_BEDTIME_MINUTE && minute < WAKE_MINUTE;
}

/** True from 02:00 up to (not including) 05:00: the hours Alex sleeps too, without the night kit. */
export function inSleepWindow(minute: number): boolean {
  return minute >= BEDTIME_MINUTE && minute < WAKE_MINUTE;
}

/**
 * The clock just ran from `prev` to `now` within one tick: did it pass 02:00 (Alex's bedtime)?
 * A big step (a clock jump, a nap) is never a crossing; callers also reset `prev` after jumping the clock.
 */
export function crossedBedtime(prev: number, now: number): boolean {
  return prev < BEDTIME_MINUTE && now >= BEDTIME_MINUTE && now - prev < 30;
}

/** Same for 01:00, the warning (only matters without the night kit). */
export function crossedWarning(prev: number, now: number): boolean {
  return prev < WARN_MINUTE && now >= WARN_MINUTE && now - prev < 30;
}

/** Same for midnight, the companions' bedtime: the clock wraps from just before 24:00 to just after 00:00. */
export function crossedCompanionBedtime(prev: number, now: number): boolean {
  return prev > MINUTES_PER_DAY - 30 && now < 30 && now < prev;
}

/** Is it the hour of the 01:00 warning (so a postponed warning is still worth showing)? */
export const inWarnHour = (minute: number): boolean => minute >= WARN_MINUTE && minute < BEDTIME_MINUTE;

/** The warning toast's lines; the hint about the lantern only when the shop sells it to her. */
export function warningLines(kitForSale: boolean): string[] {
  return kitForSale ? ['Bedtime at 02:00 - one more hour', 'A lantern would let you stay up'] : ['Bedtime at 02:00 - one more hour'];
}

/** A save loaded without the night kit between 02:00 and 05:00 wakes at 05:00 (no sequence). */
export function loadClock(clock: GameClock, kit: boolean): GameClock {
  return !kit && inSleepWindow(clock.minute) ? morningClock(clock) : clock;
}

/** Morning after a night's sleep: 05:00, one day on (the spec: "05:00 the next day"). */
export function morningClock(clock: GameClock): GameClock {
  // Bedtime is after midnight, so the day already turned: wake the same day. (Past 05:00, the next day.)
  return { day: clock.minute < WAKE_MINUTE ? clock.day : clock.day + 1, minute: WAKE_MINUTE };
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
 * (the nap counts as sleeping): then everyone wakes at 05:00. A nap that ends between 00:00 and
 * 05:00 (`inCarWindow`) leaves Pajkel and Bestia in the car until 05:00.
 */
export function napWakeClock(clock: GameClock, minuteOfDay: number, kit: boolean): GameClock {
  const c = nextOccurrence(clock, minuteOfDay);
  return !kit && inSleepWindow(c.minute) ? { day: c.day, minute: WAKE_MINUTE } : c;
}

/**
 * A short rest between naps (balance A2): after one nap wakes the companions, the next one waits this long in real time.
 * It is said kindly on the nap card with a countdown ("They are still waking up"), never as an energy bar. Not saved: it only
 * stops back-to-back naps, so a reload may skip it.
 */
export const NAP_COOLDOWN_MS = 2 * 60 * 1000;

/** Real ms left of the rest after the nap that woke at `lastNapAt` (a `Date.now()` stamp; undefined = never napped). */
export function napCooldownLeftMs(lastNapAt: number | undefined, now: number): number {
  return lastNapAt === undefined ? 0 : Math.min(NAP_COOLDOWN_MS, Math.max(0, lastNapAt + NAP_COOLDOWN_MS - now));
}

/** "1:42" for the nap card's countdown (rounds up, so it never shows 0:00 while still waiting). */
export function formatCooldown(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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

/** The nap button that is gold on the card (slice 22b): the next part of the day after the current one ("Dusk" by day, "Dawn" at night). */
export function napPrimaryId(minuteOfDay: number): NapOption['id'] {
  const next: Record<ReturnType<typeof timeOfDay>, NapOption['id']> = { dawn: 'day', day: 'dusk', dusk: 'night', night: 'dawn' };
  return next[timeOfDay(((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY)];
}

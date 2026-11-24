import { pageParams } from './urlParams';
import { isValidDate } from './core/daily/dates';

/**
 * Today's date on this device, as `YYYY-MM-DD` (the day of the daily bait box changes at local
 * midnight). The dev flag `?date=YYYY-MM-DD` fakes it. Kept out of `src/core/`, which never reads a clock.
 */
export function todayLocal(): string {
  const fake = pageParams().get('date');
  if (fake && isValidDate(fake)) return fake;
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/**
 * The current real hour on this device (0-23); the weather changes with it. The dev flag `?hour=HH` fakes it.
 */
export function hourLocal(): number {
  const fake = pageParams().get('hour');
  if (fake !== null && /^\d{1,2}$/.test(fake) && Number(fake) <= 23) return Number(fake);
  return new Date().getHours();
}

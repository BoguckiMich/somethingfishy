/**
 * Calendar dates as `YYYY-MM-DD` strings, handled as plain integers (proleptic Gregorian):
 * no `Date`, no time zones, so the result never depends on where or when the code runs.
 */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const monthDays = (y: number, m: number): number => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= monthDays(y, m);
}

/** Days since 1970-01-01 (negative before it). Throws on an invalid date. */
export function dayNumber(s: string): number {
  if (!isValidDate(s)) throw new Error(`bad date: ${s}`);
  const [y0, m, d] = s.split('-').map(Number);
  // Howard Hinnant's days-from-civil.
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Whole days from `a` to `b`: positive when `b` is later. */
export const daysBetween = (a: string, b: string): number => dayNumber(b) - dayNumber(a);

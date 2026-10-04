/**
 * Calendar-date helpers. Dates are "YYYY-MM-DD" strings in the user's own
 * timezone; arithmetic is done in UTC so DST can never shift a day.
 * Weeks run Monday to Sunday.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function isIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false;
  const d = toUtc(value);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's calendar date in the given IANA timezone. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: string): number {
  return toUtc(iso).getUTCDay();
}

/** The Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const daysSinceMonday = (weekday(iso) + 6) % 7;
  return addDays(iso, -daysSinceMonday);
}

/** True when `date` is `today` or up to `windowDays - 1` days before it. */
export function isWithinLastDays(date: string, today: string, windowDays: number): boolean {
  return isIsoDate(date) && date <= today && date >= addDays(today, -(windowDays - 1));
}

/**
 * Which week the wellbeing check-in is for right now, or null if none is due.
 * Opens Sunday for the week that's ending; Monday is a grace day for the week
 * that just ended, so a missed Sunday doesn't leave a gap.
 */
export function wellbeingTargetWeek(today: string): string | null {
  const day = weekday(today);
  if (day === 0) return weekStart(today);
  if (day === 1) return addDays(weekStart(today), -7);
  return null;
}

/** e.g. "Sat 4 Oct" */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${iso}T12:00:00Z`));
}

import { isIsoDate, todayInTimezone } from "@/lib/dates";

/**
 * "Today" for this user. In development only, `?asOf=YYYY-MM-DD` pretends it's
 * another day (handy for testing the Sunday check-in). Ignored in production.
 */
export function resolveToday(timezone: string, asOf?: string | null): string {
  if (process.env.NODE_ENV !== "production" && asOf && isIsoDate(asOf)) return asOf;
  return todayInTimezone(timezone);
}

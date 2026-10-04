import { describe, expect, it } from "vitest";
import {
  addDays,
  isIsoDate,
  isWithinLastDays,
  todayInTimezone,
  weekday,
  weekStart,
  wellbeingTargetWeek,
} from "../dates";

describe("dates", () => {
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-10-04")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("04/10/2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("uses the user's timezone for 'today'", () => {
    const now = new Date("2026-10-04T20:00:00Z");
    expect(todayInTimezone("America/Los_Angeles", now)).toBe("2026-10-04");
    expect(todayInTimezone("Asia/Kolkata", now)).toBe("2026-10-05");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("finds the Monday of the week (weeks are Mon–Sun)", () => {
    expect(weekday("2026-10-04")).toBe(0); // Sunday
    expect(weekStart("2026-10-04")).toBe("2026-09-28"); // Sunday belongs to the week before
    expect(weekStart("2026-09-28")).toBe("2026-09-28"); // Monday
    expect(weekStart("2026-10-01")).toBe("2026-09-28"); // Thursday
  });

  it("limits editing to the last 7 days", () => {
    expect(isWithinLastDays("2026-10-04", "2026-10-04", 7)).toBe(true);
    expect(isWithinLastDays("2026-09-28", "2026-10-04", 7)).toBe(true);
    expect(isWithinLastDays("2026-09-27", "2026-10-04", 7)).toBe(false);
    expect(isWithinLastDays("2026-10-05", "2026-10-04", 7)).toBe(false);
  });

  it("opens the wellbeing check-in Sunday, with a Monday grace for last week", () => {
    expect(wellbeingTargetWeek("2026-10-04")).toBe("2026-09-28"); // Sun → this week
    expect(wellbeingTargetWeek("2026-10-05")).toBe("2026-09-28"); // Mon → week just ended
    expect(wellbeingTargetWeek("2026-10-06")).toBeNull(); // Tue
    expect(wellbeingTargetWeek("2026-10-03")).toBeNull(); // Sat
  });
});

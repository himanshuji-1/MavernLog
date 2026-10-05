/**
 * Numbers behind the Progress page. Pure functions: dates in, dates out, no clock.
 */

import { addDays, weekStart } from "@/lib/dates";
import { epley } from "@/lib/engine/e1rm";
import { sessionsForExercise, type HistoryRow } from "@/lib/engine/history";

export type WeightPoint = { date: string; kg: number };
export type TrendPoint = WeightPoint & { avg: number | null };

export type RangeKey = "4w" | "8w" | "all";
export const RANGE_DAYS: Record<RangeKey, number | null> = { "4w": 28, "8w": 56, all: null };

/** The 7-day average line needs this many weigh-ins in its window to be drawn. */
export const MIN_TREND_WEIGH_INS = 3;
/** Weekly loss rates only use weeks with at least this many weigh-ins (same rule as the review). */
const MIN_WEEK_WEIGH_INS = 4;

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** First day shown for a range, or null for "all". */
export function rangeStart(range: RangeKey, today: string): string | null {
  const days = RANGE_DAYS[range];
  return days === null ? null : addDays(today, -(days - 1));
}

export function filterByRange<T extends { date: string }>(points: T[], range: RangeKey, today: string): T[] {
  const start = rangeStart(range, today);
  return start === null ? points : points.filter((p) => p.date >= start && p.date <= today);
}

/**
 * Trailing 7-day average at each weigh-in (that day and the 6 before it), drawn
 * once at least 3 weigh-ins fall in the window. Compute this on ALL points and
 * filter afterwards, so the line is right at the left edge of a short range.
 */
export function withTrend(points: WeightPoint[]): TrendPoint[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sorted.map((p, i) => {
    const windowStart = addDays(p.date, -6);
    const inWindow: number[] = [];
    for (let j = i; j >= 0 && sorted[j].date >= windowStart; j--) inWindow.push(sorted[j].kg);
    return { ...p, avg: inWindow.length >= MIN_TREND_WEIGH_INS ? round(mean(inWindow), 2) : null };
  });
}

/** Average weight per Monday–Sunday week. */
export function weeklyAverages(points: WeightPoint[]): { week_start: string; avg: number; n: number }[] {
  const weeks = new Map<string, number[]>();
  for (const p of points) {
    const w = weekStart(p.date);
    weeks.set(w, [...(weeks.get(w) ?? []), p.kg]);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week_start, kgs]) => ({ week_start, avg: mean(kgs), n: kgs.length }));
}

/**
 * Average weekly loss, as % of bodyweight. Uses each pair of consecutive weeks
 * that both have enough weigh-ins. Null if there's no such pair.
 */
export function averageWeeklyLossPct(points: WeightPoint[]): number | null {
  const weeks = weeklyAverages(points).filter((w) => w.n >= MIN_WEEK_WEIGH_INS);
  const rates: number[] = [];
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i].week_start !== addDays(weeks[i - 1].week_start, 7)) continue;
    rates.push(((weeks[i - 1].avg - weeks[i].avg) / weeks[i - 1].avg) * 100);
  }
  return rates.length ? round(mean(rates), 2) : null;
}

export type Summary = {
  /** Average of the most recent 7 days that contain weigh-ins. */
  currentAvg: number | null;
  /** The last weigh-in that average is based on. */
  asOf: string | null;
  /** Start weight minus current average. Negative means up. */
  totalLostKg: number | null;
  avgWeeklyLossPct: number | null;
  /** Current average minus goal, never below 0. */
  toGoalKg: number | null;
  goalReached: boolean;
};

export function summarize(args: {
  points: WeightPoint[];
  startWeightKg: number;
  goalWeightKg: number;
}): Summary {
  const { points, startWeightKg, goalWeightKg } = args;
  const avgWeeklyLossPct = averageWeeklyLossPct(points);

  if (points.length === 0) {
    return { currentAvg: null, asOf: null, totalLostKg: null, avgWeeklyLossPct, toGoalKg: null, goalReached: false };
  }

  const latest = points.reduce((a, b) => (b.date > a.date ? b : a));
  const windowStart = addDays(latest.date, -6);
  const currentAvg = round(
    mean(points.filter((p) => p.date >= windowStart && p.date <= latest.date).map((p) => p.kg)),
    1,
  );

  return {
    currentAvg,
    asOf: latest.date,
    totalLostKg: round(startWeightKg - currentAvg, 1),
    avgWeeklyLossPct,
    toGoalKg: round(Math.max(0, currentAvg - goalWeightKg), 1),
    goalReached: currentAvg <= goalWeightKg,
  };
}

export type StrengthPoint = { date: string; e1rm: number; weight_kg: number; reps: number };

/** Best estimated 1RM (Epley) of each session for one exercise, oldest first. */
export function strengthSeries(rows: HistoryRow[], exerciseId: string): StrengthPoint[] {
  return sessionsForExercise(rows, exerciseId).map((session) => {
    let best = session.sets[0];
    for (const set of session.sets) {
      if (epley(set.weight_kg, set.reps) > epley(best.weight_kg, best.reps)) best = set;
    }
    return {
      date: session.date,
      e1rm: round(epley(best.weight_kg, best.reps), 1),
      weight_kg: best.weight_kg,
      reps: best.reps,
    };
  });
}

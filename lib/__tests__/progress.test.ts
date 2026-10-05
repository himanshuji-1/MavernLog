import { describe, expect, it } from "vitest";
import type { HistoryRow } from "@/lib/engine/history";
import {
  averageWeeklyLossPct,
  filterByRange,
  rangeStart,
  strengthSeries,
  summarize,
  weeklyAverages,
  withTrend,
  type WeightPoint,
} from "../progress";

const p = (date: string, kg: number): WeightPoint => ({ date, kg });

/** n consecutive daily weigh-ins starting at `start`, all at `kg`. */
const run = (start: string, n: number, kg: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return p(d.toISOString().slice(0, 10), kg);
  });

describe("range", () => {
  const today = "2026-10-07";

  it("4w and 8w cover exactly 28 and 56 days including today", () => {
    expect(rangeStart("4w", today)).toBe("2026-09-10");
    expect(rangeStart("8w", today)).toBe("2026-08-13");
    expect(rangeStart("all", today)).toBeNull();
  });

  it("filters points to the range and never shows the future", () => {
    const pts = [p("2026-09-09", 90), p("2026-09-10", 89), p("2026-10-07", 88), p("2026-10-08", 87)];
    expect(filterByRange(pts, "4w", today).map((x) => x.date)).toEqual(["2026-09-10", "2026-10-07"]);
    expect(filterByRange(pts, "all", today)).toHaveLength(4);
  });
});

describe("withTrend", () => {
  it("needs 3 weigh-ins in the window before drawing an average", () => {
    const t = withTrend([p("2026-10-01", 90), p("2026-10-02", 91), p("2026-10-03", 92)]);
    expect(t.map((x) => x.avg)).toEqual([null, null, 91]);
  });

  it("averages that day and the six before it, ignoring older weigh-ins", () => {
    const t = withTrend([p("2026-10-01", 100), p("2026-10-08", 90), p("2026-10-09", 91), p("2026-10-10", 92)]);
    // On the 10th the window is 4–10 Oct: the 1 Oct weigh-in is out.
    expect(t[3].avg).toBe(91);
  });

  it("sorts unsorted input and keeps one entry per point", () => {
    const t = withTrend([p("2026-10-03", 92), p("2026-10-01", 90), p("2026-10-02", 91)]);
    expect(t.map((x) => x.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });
});

describe("weekly averages and loss rate", () => {
  it("groups by Monday–Sunday week", () => {
    const w = weeklyAverages([p("2026-09-27", 90), p("2026-09-28", 80), p("2026-10-04", 82)]);
    expect(w.map((x) => [x.week_start, x.avg, x.n])).toEqual([
      ["2026-09-21", 90, 1], // Sunday belongs to the week before
      ["2026-09-28", 81, 2],
    ]);
  });

  it("averages the loss between consecutive weeks that have enough weigh-ins", () => {
    // 90 → 89.55 (0.5%) → 89.1 (~0.5%)
    const pts = [...run("2026-09-14", 7, 90), ...run("2026-09-21", 7, 89.55), ...run("2026-09-28", 7, 89.1)];
    expect(averageWeeklyLossPct(pts)).toBeCloseTo(0.5, 1);
  });

  it("skips weeks with fewer than 4 weigh-ins", () => {
    const pts = [...run("2026-09-14", 7, 90), ...run("2026-09-21", 3, 80), ...run("2026-09-28", 7, 89.55)];
    expect(averageWeeklyLossPct(pts)).toBeNull(); // the thin week breaks both pairs
  });

  it("does not bridge a gap week", () => {
    const pts = [...run("2026-09-14", 7, 90), ...run("2026-09-28", 7, 89.55)];
    expect(averageWeeklyLossPct(pts)).toBeNull();
  });

  it("is negative when weight went up, and null with no data", () => {
    expect(averageWeeklyLossPct([...run("2026-09-14", 7, 90), ...run("2026-09-21", 7, 90.9)])).toBeCloseTo(-1, 5);
    expect(averageWeeklyLossPct([])).toBeNull();
  });
});

describe("summarize", () => {
  it("is empty without weigh-ins", () => {
    const s = summarize({ points: [], startWeightKg: 90, goalWeightKg: 80 });
    expect(s).toMatchObject({ currentAvg: null, totalLostKg: null, toGoalKg: null, goalReached: false });
  });

  it("uses the 7 days up to the latest weigh-in", () => {
    const pts = [p("2026-09-01", 95), ...run("2026-10-01", 7, 88)];
    const s = summarize({ points: pts, startWeightKg: 90, goalWeightKg: 80 });
    expect(s.currentAvg).toBe(88);
    expect(s.asOf).toBe("2026-10-07");
    expect(s.totalLostKg).toBe(2);
    expect(s.toGoalKg).toBe(8);
    expect(s.goalReached).toBe(false);
  });

  it("totalLost is negative when above the start weight", () => {
    const s = summarize({ points: run("2026-10-01", 3, 91), startWeightKg: 90, goalWeightKg: 80 });
    expect(s.totalLostKg).toBe(-1);
  });

  it("reports the goal as reached, with no negative distance", () => {
    const s = summarize({ points: run("2026-10-01", 3, 79.5), startWeightKg: 90, goalWeightKg: 80 });
    expect(s.goalReached).toBe(true);
    expect(s.toGoalKg).toBe(0);
  });
});

describe("strengthSeries", () => {
  const row = (session_id: string, date: string, weight_kg: number, reps: number): HistoryRow => ({
    session_id,
    performed_on: date,
    started_at: `${date}T10:00:00Z`,
    exercise_id: "bench",
    weight_kg,
    reps,
    rir: 2,
  });

  it("takes the best-e1RM set from each session, oldest first, rounded to 0.1", () => {
    const rows = [
      row("b", "2026-10-05", 62.5, 5), // 72.9
      row("a", "2026-10-01", 60, 5), // 70
      row("a", "2026-10-01", 60, 3), // 66
      row("b", "2026-10-05", 70, 1), // 70 (a heavy single is worse than the 5)
    ];
    expect(strengthSeries(rows, "bench")).toEqual([
      { date: "2026-10-01", e1rm: 70, weight_kg: 60, reps: 5 },
      { date: "2026-10-05", e1rm: 72.9, weight_kg: 62.5, reps: 5 },
    ]);
  });

  it("is empty for an exercise with no history", () => {
    expect(strengthSeries([row("a", "2026-10-01", 60, 5)], "squat")).toEqual([]);
  });
});

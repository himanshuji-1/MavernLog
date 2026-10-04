import { describe, expect, it } from "vitest";
import { DEFAULT_EXERCISES } from "@/lib/default-exercises";
import { addDays, weekStart } from "@/lib/dates";
import { MIN_CALORIES, reviewSequence, weekStats } from "@/lib/engine/weeklyReview";
import {
  SEED_CALORIE_TARGET,
  SEED_STEP_TARGET,
  buildScenario,
  type Scenario,
} from "../scenario";

const TODAY = "2026-10-07"; // a Wednesday
const build = (today = TODAY) => buildScenario({ today, exercises: DEFAULT_EXERCISES });

function reviews(s: Scenario) {
  return reviewSequence({
    weeks: s.weeks,
    logs: s.dailyLogs,
    wellbeing: s.wellbeing,
    initial: { calorie_target: SEED_CALORIE_TARGET, step_target: SEED_STEP_TARGET },
    previous: null,
  });
}

describe("seed scenario", () => {
  it("is deterministic: building twice gives identical data", () => {
    expect(build()).toEqual(build());
  });

  it("covers eight finished Monday–Sunday weeks, ending the week before this one", () => {
    const s = build();
    expect(s.weeks).toHaveLength(8);
    expect(s.weeks.every((w) => weekStart(w) === w)).toBe(true);
    expect(addDays(s.weeks[7], 7)).toBe(weekStart(TODAY));
  });

  it("only contains past dates", () => {
    const s = build();
    const dates = [...s.dailyLogs.map((l) => l.log_date), ...s.sessions.map((x) => x.performed_on)];
    expect(dates.every((d) => d < TODAY)).toBe(true);
  });

  it("has at least 4 weigh-ins in every finished week", () => {
    const s = build();
    for (const week of s.weeks) {
      expect(weekStats(s.dailyLogs, week, null).weighIns, week).toBeGreaterThanOrEqual(4);
    }
  });

  it("works for any day of the week it is run on", () => {
    for (let i = 0; i < 7; i++) {
      const s = build(addDays("2026-10-05", i));
      expect(reviews(s).results.map((r) => r.outcome)).toEqual(reviews(build()).results.map((r) => r.outcome));
    }
  });
});

describe("the weekly reviews the scenario produces", () => {
  const { results, final } = reviews(build());
  const outcomes = results.map((r) => r.outcome);

  it("tells the intended story, week by week", () => {
    expect(outcomes).toEqual([
      "insufficient_data", // 1: baseline
      "on_track", //          2
      "simplify", //          3: low adherence
      "on_track", //          4
      "stall_watch", //       5: flat
      "ladder_step", //       6: flat again → rung 1
      "on_track", //          7
      "diet_break", //        8: wellbeing low two weeks running
    ]);
  });

  it("week 6 sets a step target of average steps + 2,000 at ladder rung 1", () => {
    const week6 = results[5];
    expect(week6.ladder_rung).toBe(1);
    expect(week6.step_target_after).toBeGreaterThanOrEqual(9000);
    expect(week6.step_target_after).toBeLessThanOrEqual(10500);
    expect(week6.step_target_after! % 500).toBe(0);
    expect(week6.calorie_target_after).toBe(SEED_CALORIE_TARGET);
  });

  it("the diet break leaves targets alone and restarts the ladder", () => {
    const week8 = results[7];
    expect(week8.ladder_rung).toBe(0);
    expect(week8.message).toContain("signal, not a failure");
    expect(week8.calorie_target_after).toBe(results[6].calorie_target_after);
    expect(week8.step_target_after).toBe(results[6].step_target_after);
  });

  it("never goes below the calorie floor", () => {
    expect(results.every((r) => r.calorie_target_after >= MIN_CALORIES)).toBe(true);
    expect(final.calorie_target).toBeGreaterThanOrEqual(MIN_CALORIES);
  });

  it("weight trends from about 90 kg downwards with a flat stretch in weeks 5–6", () => {
    const avg = results.map((r) => r.avg_weight_kg!);
    expect(avg[0]).toBeGreaterThan(89.5);
    expect(avg[7]).toBeLessThan(88.5);
    expect(Math.abs(avg[4] - avg[3])).toBeLessThan(0.4);
    expect(Math.abs(avg[5] - avg[4])).toBeLessThan(0.4);
  });
});

describe("the seeded workouts", () => {
  const s = build();
  const weightsFor = (exercise: string) =>
    s.sessions.flatMap((x) => {
      const sets = x.sets.filter((set) => set.exercise === exercise);
      return sets.length ? [Math.max(...sets.map((set) => set.weight_kg))] : [];
    });

  it("trains three times a week", () => {
    const perWeek = s.weeks.map(
      (w) => s.sessions.filter((x) => x.performed_on >= w && x.performed_on < addDays(w, 7)).length,
    );
    expect(perWeek).toEqual(Array(8).fill(3));
  });

  it("Bench Press has exactly one deload, after its double miss", () => {
    const w = weightsFor("Bench Press");
    const drops = w.flatMap((kg, i) => (i > 0 && kg < w[i - 1] ? [i] : []));
    expect(drops).toHaveLength(1);
    expect(w[drops[0]]).toBeLessThan(w[drops[0] - 1]);
  });

  it("no other exercise ever drops in weight", () => {
    for (const name of ["Squat", "Barbell Row", "Deadlift", "Overhead Press", "Lat Pulldown"]) {
      const w = weightsFor(name);
      expect(w.every((kg, i) => i === 0 || kg >= w[i - 1]), name).toBe(true);
    }
  });

  it("every set is a valid set (matches the database limits)", () => {
    for (const set of s.sessions.flatMap((x) => x.sets)) {
      expect(set.weight_kg).toBeGreaterThanOrEqual(0);
      expect(set.reps).toBeGreaterThanOrEqual(1);
      expect(set.rir).toBeGreaterThanOrEqual(0);
      expect(set.rir).toBeLessThanOrEqual(5);
    }
  });

  it("skips exercises the user doesn't have", () => {
    const only = buildScenario({
      today: TODAY,
      exercises: DEFAULT_EXERCISES.filter((e) => e.name === "Squat"),
    });
    expect(new Set(only.sessions.flatMap((x) => x.sets.map((set) => set.exercise)))).toEqual(new Set(["Squat"]));
  });
});

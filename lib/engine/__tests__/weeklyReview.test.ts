import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  MIN_CALORIES,
  clampCalories,
  nextLadderStep,
  pendingWeeks,
  reviewSequence,
  reviewWeek,
  weekStats,
  type DailyEntry,
  type DietFollowed,
  type PreviousReview,
  type ReviewInput,
  type ReviewOutcome,
  type Targets,
} from "../weeklyReview";

// Mondays: PREV = the week before THIS.
const PREV = "2026-09-14";
const THIS = "2026-09-21";

const OK_DIET: (DietFollowed | null)[] = ["yes", "yes", "yes", "yes", "yes", "yes", "mostly"]; // 93%
const BAD_DIET: (DietFollowed | null)[] = ["yes", "mostly", "no", "no", null, "mostly", "yes"]; // 43%

/** Seven daily logs for the week starting `ws`. */
function week(
  ws: string,
  o: {
    weights?: (number | null)[];
    diet?: (DietFollowed | null)[];
    steps?: number | null;
    sleep?: number | null;
  } = {},
): DailyEntry[] {
  const weights = o.weights ?? Array(7).fill(null);
  const diet = o.diet ?? OK_DIET;
  return Array.from({ length: 7 }, (_, i) => ({
    log_date: addDays(ws, i),
    bodyweight_kg: weights[i] ?? null,
    steps: o.steps === undefined ? 8000 : o.steps,
    sleep_hours: o.sleep === undefined ? 7.5 : o.sleep,
    diet_followed: diet[i] ?? null,
  }));
}

/** A week whose seven weigh-ins all equal `kg`. */
const flat = (ws: string, kg: number, o: Parameters<typeof week>[1] = {}) =>
  week(ws, { ...o, weights: Array(7).fill(kg) });

const TARGETS: Targets = { calorie_target: 2200, step_target: null };
const GOOD = { mood: 4, energy: 4, motivation: 4 };
const LOW = { mood: 1, energy: 2, motivation: 2 };

function input(over: Partial<ReviewInput> & { prevKg?: number; thisKg?: number } = {}): ReviewInput {
  const { prevKg = 90, thisKg = 89.55, ...rest } = over; // 0.5% loss by default
  return {
    weekStart: THIS,
    logs: [...flat(PREV, prevKg), ...flat(THIS, thisKg)],
    wellbeing: { thisWeek: GOOD, lastWeek: GOOD },
    targets: TARGETS,
    previous: null,
    ...rest,
  };
}

const stallWatch: PreviousReview = {
  week_start: PREV,
  outcome: "stall_watch",
  loss_rate_pct: 0.1,
  ladder_rung: 0,
};

describe("weekStats", () => {
  it("averages only the days that have a weigh-in", () => {
    const s = weekStats(week(THIS, { weights: [90, null, 91, null, null, null, 92] }), THIS, null);
    expect(s.weighIns).toBe(3);
    expect(s.avgWeight).toBeCloseTo(91, 5);
  });

  it("ignores logs from other weeks", () => {
    const logs = [...flat(PREV, 100), ...flat(THIS, 90)];
    expect(weekStats(logs, THIS, null).avgWeight).toBe(90);
  });

  it("has no average without weigh-ins", () => {
    expect(weekStats(week(THIS), THIS, null).avgWeight).toBeNull();
  });

  it("scores adherence: yes = 1, mostly = ½, no or not logged = 0, out of 7 days", () => {
    const adherence = (diet: (DietFollowed | null)[]) =>
      weekStats(week(THIS, { diet }), THIS, null).adherencePct;
    expect(adherence(Array(7).fill("yes"))).toBe(100);
    expect(adherence(Array(7).fill("mostly"))).toBe(50);
    expect(adherence(Array(7).fill("no"))).toBe(0);
    expect(adherence(["yes", "yes", "yes", null, null, null, null])).toBeCloseTo((3 / 7) * 100, 5);
    expect(adherence(["yes", "mostly", "no", null, "yes", "yes", "yes"])).toBeCloseTo((4.5 / 7) * 100, 5);
  });
});

describe("loss rate", () => {
  it("is (previous average − this average) ÷ previous average, as a percent", () => {
    const r = reviewWeek(input({ prevKg: 90, thisKg: 89.55 }));
    expect(r.prev_avg_weight_kg).toBe(90);
    expect(r.avg_weight_kg).toBe(89.55);
    expect(r.loss_rate_pct).toBe(0.5);
  });

  it("is negative when weight went up", () => {
    expect(reviewWeek(input({ prevKg: 90, thisKg: 90.9 })).loss_rate_pct).toBe(-1);
  });
});

describe("insufficient data", () => {
  it("fewer than 4 weigh-ins this week → nothing changes", () => {
    const thisWeek = week(THIS, { weights: [89, 89, 89, null, null, null, null] });
    const r = reviewWeek(input({ logs: [...flat(PREV, 90), ...thisWeek] }));
    expect(r.outcome).toBe("insufficient_data");
    expect(r.inputs.reason).toBe("too_few_weigh_ins");
    expect(r.message).toContain("Only 3 weigh-ins");
    expect(r.calorie_target_after).toBe(2200);
    expect(r.loss_rate_pct).toBeNull();
  });

  it("fewer than 4 weigh-ins last week → baseline, nothing changes", () => {
    const prevWeek = week(PREV, { weights: [90, 90, 90, null, null, null, null] });
    const r = reviewWeek(input({ logs: [...prevWeek, ...flat(THIS, 89.5)] }));
    expect(r.outcome).toBe("insufficient_data");
    expect(r.inputs.reason).toBe("baseline");
  });

  it("exactly 4 weigh-ins is enough", () => {
    const four = (ws: string, kg: number) => week(ws, { weights: [kg, kg, kg, kg, null, null, null] });
    const r = reviewWeek(input({ logs: [...four(PREV, 90), ...four(THIS, 89.55)] }));
    expect(r.outcome).toBe("on_track");
  });

  it("the very first week has nothing to compare against", () => {
    const r = reviewWeek(input({ logs: flat(THIS, 90) }));
    expect(r.outcome).toBe("insufficient_data");
  });
});

describe("outcomes, one at a time", () => {
  it("safety: wellbeing low two weeks running → diet break, targets untouched, ladder restarts", () => {
    const r = reviewWeek(
      input({
        wellbeing: { thisWeek: LOW, lastWeek: LOW },
        previous: { ...stallWatch, ladder_rung: 3 },
      }),
    );
    expect(r.outcome).toBe("diet_break");
    expect(r.ladder_rung).toBe(0);
    expect(r.calorie_target_after).toBe(2200);
    expect(r.message).toContain("signal, not a failure");
  });

  it("safety: wellbeing low one week only → no diet break", () => {
    const r = reviewWeek(input({ wellbeing: { thisWeek: LOW, lastWeek: GOOD } }));
    expect(r.outcome).toBe("on_track");
  });

  it("safety: losing over 1% a week → calories +150", () => {
    const r = reviewWeek(input({ prevKg: 90, thisKg: 89 })); // 1.11%
    expect(r.outcome).toBe("too_fast");
    expect(r.calorie_target_after).toBe(2350);
  });

  it("exactly 1.0% is not 'too fast'", () => {
    const r = reviewWeek(input({ prevKg: 90, thisKg: 89.1 }));
    expect(r.loss_rate_pct).toBe(1);
    expect(r.outcome).toBe("on_track");
  });

  it("safety: calorie target under the floor is raised to the floor", () => {
    const r = reviewWeek(input({ targets: { calorie_target: 1500, step_target: null } }));
    expect(r.outcome).toBe("raise_calories");
    expect(r.calorie_target_after).toBe(MIN_CALORIES);
  });

  it("the floor applies even when there is not enough data to review", () => {
    const r = reviewWeek(input({ logs: [], targets: { calorie_target: 1500, step_target: null } }));
    expect(r.outcome).toBe("raise_calories");
    expect(r.calorie_target_after).toBe(MIN_CALORIES);
  });

  it("adherence under 80% → simplify, no changes, names the weakest habit", () => {
    const r = reviewWeek(
      input({ logs: [...flat(PREV, 90), ...flat(THIS, 89.55, { diet: BAD_DIET })] }),
    );
    expect(r.outcome).toBe("simplify");
    expect(r.adherence_pct).toBeCloseTo(42.9, 1);
    expect(r.calorie_target_after).toBe(2200);
    expect(r.inputs.focus_habit).toBe("diet");
    expect(r.message).toContain("sticking to your diet");
  });

  it("simplify names the weakest habit, which isn't always diet", () => {
    // 79% adherence (just under 80), but sleep was worse: 0 of 7 nights at 7h+.
    const diet: (DietFollowed | null)[] = ["yes", "yes", "yes", "yes", "mostly", "mostly", "mostly"]; // 5.5/7 = 78.6%
    const r = reviewWeek(
      input({ logs: [...flat(PREV, 90), ...flat(THIS, 89.55, { diet, sleep: 5.5 })] }),
    );
    expect(r.outcome).toBe("simplify");
    expect(r.inputs.focus_habit).toBe("sleep");
  });

  it("exactly 80% adherence is fine", () => {
    // 5.6 of 7 isn't possible; 4 yes + 3 mostly = 5.5/7 = 78.6 (<80); 5 yes + 1 mostly + 1 no = 5.5; use 6 yes + 1 no = 85.7
    const diet: (DietFollowed | null)[] = ["yes", "yes", "yes", "yes", "yes", "yes", "no"];
    const r = reviewWeek(input({ logs: [...flat(PREV, 90), ...flat(THIS, 89.55, { diet })] }));
    expect(r.outcome).toBe("on_track");
  });

  it("on track (0.3–0.7%) → change nothing", () => {
    for (const thisKg of [89.73, 89.55, 89.37]) {
      const r = reviewWeek(input({ prevKg: 90, thisKg }));
      expect(r.outcome).toBe("on_track");
      expect(r.calorie_target_after).toBe(2200);
      expect(r.step_target_after).toBeNull();
      expect(r.ladder_rung).toBe(0);
    }
  });

  it("0.7%–1.0% counts as on track too (no change)", () => {
    expect(reviewWeek(input({ prevKg: 90, thisKg: 89.25 })).outcome).toBe("on_track"); // 0.83%
  });

  it("stalled for one week → watch, no change", () => {
    const r = reviewWeek(input({ prevKg: 90, thisKg: 90 }));
    expect(r.outcome).toBe("stall_watch");
    expect(r.calorie_target_after).toBe(2200);
    expect(r.step_target_after).toBeNull();
  });

  it("gaining weight counts as stalled", () => {
    expect(reviewWeek(input({ prevKg: 90, thisKg: 90.5 })).outcome).toBe("stall_watch");
  });

  it("stalled for two weeks in a row → ladder rung 1: step target = average steps + 2,000", () => {
    const r = reviewWeek(
      input({
        prevKg: 90,
        thisKg: 90,
        logs: [...flat(PREV, 90), ...flat(THIS, 90, { steps: 7400 })],
        previous: stallWatch,
      }),
    );
    expect(r.outcome).toBe("ladder_step");
    expect(r.ladder_rung).toBe(1);
    expect(r.step_target_after).toBe(9500); // 7,400 → 7,500 (nearest 500) + 2,000
    expect(r.calorie_target_after).toBe(2200);
  });

  it("the previous stalled week must be the week right before", () => {
    const r = reviewWeek(
      input({ prevKg: 90, thisKg: 90, previous: { ...stallWatch, week_start: "2026-09-07" } }),
    );
    expect(r.outcome).toBe("stall_watch");
  });

  it("a ladder step needs two fresh stalled weeks: right after a step it only watches", () => {
    const r = reviewWeek(
      input({
        prevKg: 90,
        thisKg: 90,
        previous: { ...stallWatch, outcome: "ladder_step", ladder_rung: 1 },
      }),
    );
    expect(r.outcome).toBe("stall_watch");
    expect(r.ladder_rung).toBe(1);
  });
});

describe("order of precedence: the earliest matching rule wins", () => {
  // Everything true at once: wellbeing low twice, losing too fast, calories
  // under the floor, adherence low. Then peel the rules off one by one.
  const everything = (): ReviewInput =>
    input({
      prevKg: 90,
      thisKg: 88.5, // 1.67% loss
      logs: [...flat(PREV, 90), ...flat(THIS, 88.5, { diet: BAD_DIET })],
      wellbeing: { thisWeek: LOW, lastWeek: LOW },
      targets: { calorie_target: 1600, step_target: null },
    });

  it("wellbeing beats too-fast, floor and adherence", () => {
    expect(reviewWeek(everything()).outcome).toBe("diet_break");
  });

  it("too-fast beats floor and adherence (and the floor still holds afterwards)", () => {
    const r = reviewWeek({ ...everything(), wellbeing: { thisWeek: GOOD, lastWeek: GOOD } });
    expect(r.outcome).toBe("too_fast");
    expect(r.calorie_target_after).toBe(MIN_CALORIES); // 1,600 + 150 = 1,750 → clamped
  });

  it("the floor beats adherence and stalling", () => {
    const r = reviewWeek({
      ...everything(),
      wellbeing: { thisWeek: GOOD, lastWeek: GOOD },
      logs: [...flat(PREV, 90), ...flat(THIS, 90, { diet: BAD_DIET })], // stalled, low adherence
      previous: stallWatch,
    });
    expect(r.outcome).toBe("raise_calories");
  });

  it("not enough data beats adherence", () => {
    const r = reviewWeek({
      ...everything(),
      wellbeing: { thisWeek: GOOD, lastWeek: GOOD },
      targets: TARGETS,
      logs: week(THIS, { diet: BAD_DIET }),
    });
    expect(r.outcome).toBe("insufficient_data");
  });

  it("adherence beats on track", () => {
    const r = reviewWeek({
      ...everything(),
      wellbeing: { thisWeek: GOOD, lastWeek: GOOD },
      targets: TARGETS,
      logs: [...flat(PREV, 90), ...flat(THIS, 89.55, { diet: BAD_DIET })],
    });
    expect(r.outcome).toBe("simplify");
  });

  it("adherence beats a stall that would otherwise step up the ladder", () => {
    const r = reviewWeek({
      ...everything(),
      wellbeing: { thisWeek: GOOD, lastWeek: GOOD },
      targets: TARGETS,
      logs: [...flat(PREV, 90), ...flat(THIS, 90, { diet: BAD_DIET })],
      previous: stallWatch,
    });
    expect(r.outcome).toBe("simplify");
    expect(r.ladder_rung).toBe(0);
  });
});

describe("strategy ladder", () => {
  const t = (calorie_target: number, step_target: number | null): Targets => ({ calorie_target, step_target });

  it("rung 1: steps = average + 2,000, rounded to 500", () => {
    const s = nextLadderStep(0, t(2200, null), 6120);
    expect(s).toMatchObject({ kind: "steps", rung: 1, targets: { step_target: 8000 } });
  });

  it("rung 2: calories −150", () => {
    expect(nextLadderStep(1, t(2200, 8000), 8000)).toMatchObject({
      kind: "calories",
      rung: 2,
      targets: { calorie_target: 2050, step_target: 8000 },
    });
  });

  it("rung 3: steps +2,000 more", () => {
    expect(nextLadderStep(2, t(2050, 8000), 8000)).toMatchObject({
      kind: "steps",
      rung: 3,
      targets: { step_target: 10000 },
    });
  });

  it("rung 4: calories −150 more", () => {
    expect(nextLadderStep(3, t(2050, 10000), 8000)).toMatchObject({
      kind: "calories",
      rung: 4,
      targets: { calorie_target: 1900 },
    });
  });

  it("rung 5: diet break", () => {
    expect(nextLadderStep(4, t(1900, 10000), 8000).kind).toBe("break");
  });

  it("a calorie cut blocked by the floor becomes a diet break", () => {
    expect(nextLadderStep(1, t(1900, 8000), 8000).kind).toBe("break"); // 1,750 < 1,800
    expect(nextLadderStep(1, t(1950, 8000), 8000).kind).toBe("calories"); // 1,800 is allowed
  });

  it("uses a sensible base when no steps were logged", () => {
    expect(nextLadderStep(0, t(2200, null), null)).toMatchObject({ targets: { step_target: 8000 } });
  });
});

describe("a long stall climbs the whole ladder, then takes a break and restarts", () => {
  // Fourteen weeks of totally flat weight and perfect adherence.
  const weeks = Array.from({ length: 14 }, (_, i) => addDays("2026-01-05", i * 7));
  const logs = weeks.flatMap((w) => flat(w, 90, { steps: 7000 }));

  it("steps up every second week, in order", () => {
    const { results } = reviewSequence({
      weeks: weeks.slice(1), // the first week has no previous week to compare to
      logs,
      wellbeing: [],
      initial: { calorie_target: 2400, step_target: null },
      previous: null,
    });
    const outcomes = results.map((r) => r.outcome);
    const expected: ReviewOutcome[] = [
      "stall_watch", "ladder_step", // rung 1: steps
      "stall_watch", "ladder_step", // rung 2: calories
      "stall_watch", "ladder_step", // rung 3: steps
      "stall_watch", "ladder_step", // rung 4: calories
      "stall_watch", "diet_break", //  rung 5: break
      "stall_watch", "ladder_step", // restarts at rung 1
      "stall_watch", //                 (13th and last review)
    ];
    expect(outcomes).toEqual(expected);

    const steps = results.filter((r) => r.outcome === "ladder_step");
    expect(steps.map((r) => r.ladder_rung)).toEqual([1, 2, 3, 4, 1]);
    expect(steps[0].step_target_after).toBe(9000);
    expect(steps[1].calorie_target_after).toBe(2250);
    expect(steps[2].step_target_after).toBe(11000);
    expect(steps[3].calorie_target_after).toBe(2100);

    const brk = results.find((r) => r.outcome === "diet_break")!;
    expect(brk.ladder_rung).toBe(0);
    expect(brk.calorie_target_after).toBe(2100); // a break doesn't change targets
  });
});

describe("calorie floor: never below 1,800", () => {
  it("holds for every starting target, ladder position and situation", () => {
    const situations: Record<string, NonNullable<Parameters<typeof input>[0]>> = {
      onTrack: { prevKg: 90, thisKg: 89.55 },
      tooFast: { prevKg: 90, thisKg: 88 },
      stalled: { prevKg: 90, thisKg: 90, previous: stallWatch },
      lowAdherence: { logs: [...flat(PREV, 90), ...flat(THIS, 89.55, { diet: BAD_DIET })] },
      lowWellbeing: { wellbeing: { thisWeek: LOW, lastWeek: LOW } },
      noData: { logs: [] },
    };

    let checked = 0;
    for (let calories = 1000; calories <= 4000; calories += 50) {
      for (let rung = 0; rung <= 4; rung++) {
        for (const [name, over] of Object.entries(situations)) {
          const base = input(over);
          const r = reviewWeek({
            ...base,
            targets: { calorie_target: calories, step_target: 8000 },
            previous: { ...(base.previous ?? stallWatch), ladder_rung: rung },
          });
          expect(r.calorie_target_after, `${name} @ ${calories} kcal, rung ${rung}`).toBeGreaterThanOrEqual(MIN_CALORIES);
          checked++;
        }
      }
    }
    expect(checked).toBe(61 * 5 * 6);
  });

  it("clampCalories raises low values, keeps high ones, and rounds", () => {
    expect(clampCalories(1200)).toBe(1800);
    expect(clampCalories(1799.6)).toBe(1800);
    expect(clampCalories(2200)).toBe(2200);
    expect(clampCalories(2049.6)).toBe(2050);
  });
});

describe("pendingWeeks", () => {
  const today = "2026-10-07"; // Wednesday. Last finished week starts Mon 2026-09-28.

  it("is empty with no logs", () => {
    expect(pendingWeeks({ earliestLogDate: null, lastReviewedWeek: null, today })).toEqual([]);
  });

  it("starts at the Monday of the first log and stops at the last finished week", () => {
    expect(pendingWeeks({ earliestLogDate: "2026-09-16", lastReviewedWeek: null, today })).toEqual([
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
  });

  it("continues after the last reviewed week", () => {
    expect(pendingWeeks({ earliestLogDate: "2026-08-01", lastReviewedWeek: "2026-09-21", today })).toEqual([
      "2026-09-28",
    ]);
  });

  it("never includes the current, unfinished week", () => {
    expect(pendingWeeks({ earliestLogDate: "2026-10-05", lastReviewedWeek: null, today })).toEqual([]);
  });

  it("nothing is pending when everything finished is reviewed", () => {
    expect(pendingWeeks({ earliestLogDate: "2026-08-01", lastReviewedWeek: "2026-09-28", today })).toEqual([]);
  });
});

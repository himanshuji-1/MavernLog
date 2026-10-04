/**
 * Weekly review: looks at a finished Monday–Sunday week and decides whether to
 * change anything. Pure functions: no database, no clock, no AI.
 *
 * Checked strictly in this order, first match wins:
 *   1. safety   (wellbeing low 2 weeks → diet break; losing too fast; calories under the floor)
 *   2. not enough data
 *   3. adherence under 80%   → simplify
 *   4. on track              → change nothing
 *   5. stalled               → one rung up the strategy ladder (after 2 stalled weeks)
 */

import { addDays, weekStart as mondayOf } from "@/lib/dates";
import { DIET_BREAK_WELLBEING_MESSAGE, lowTwoWeeksRunning, type Wellbeing } from "./wellbeing";

export const MIN_CALORIES = 1800;
export const LOSS_ON_TRACK_MIN_PCT = 0.3;
export const LOSS_ON_TRACK_MAX_PCT = 0.7;
export const LOSS_TOO_FAST_PCT = 1.0;
export const ADHERENCE_MIN_PCT = 80;
export const MIN_WEIGH_INS = 4;
export const CALORIE_STEP = 150;
export const STEP_TARGET_INCREASE = 2000;
export const MAX_STEP_TARGET = 30000;
const DEFAULT_STEPS_BASE = 6000;
const SLEEP_GOAL_HOURS = 7;
const LADDER_LAST_RUNG = 4;

/** The single place the calorie floor is enforced. Everything that sets calories goes through it. */
export function clampCalories(calories: number): number {
  return Math.max(MIN_CALORIES, Math.round(calories));
}

export type DietFollowed = "yes" | "mostly" | "no";

export type DailyEntry = {
  log_date: string;
  bodyweight_kg: number | null;
  steps: number | null;
  sleep_hours: number | null;
  diet_followed: DietFollowed | null;
};

export type WellbeingEntry = Wellbeing & { week_start: string };

export type ReviewOutcome =
  | "insufficient_data"
  | "diet_break"
  | "too_fast"
  | "raise_calories"
  | "simplify"
  | "on_track"
  | "stall_watch"
  | "ladder_step";

export type PreviousReview = {
  week_start: string;
  outcome: ReviewOutcome;
  loss_rate_pct: number | null;
  /** Ladder position after that review: 0 = nothing applied yet, 1–4 = rungs applied. */
  ladder_rung: number;
};

export type Targets = { calorie_target: number; step_target: number | null };

export type ReviewInput = {
  /** Monday of the week being reviewed. */
  weekStart: string;
  /** Daily logs covering at least this week and the one before it. */
  logs: DailyEntry[];
  wellbeing: { thisWeek: Wellbeing | null; lastWeek: Wellbeing | null };
  targets: Targets;
  previous: PreviousReview | null;
};

export type ReviewResult = {
  week_start: string;
  outcome: ReviewOutcome;
  message: string;
  avg_weight_kg: number | null;
  prev_avg_weight_kg: number | null;
  loss_rate_pct: number | null;
  adherence_pct: number;
  ladder_rung: number;
  calorie_target_before: number;
  calorie_target_after: number;
  step_target_before: number | null;
  step_target_after: number | null;
  /** The numbers behind the decision, kept so every review can be explained later. */
  inputs: Record<string, unknown>;
};

// ------------------------------------------------------------------ stats

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const nonNull = <T>(v: T | null): v is T => v !== null;
const roundTo500 = (n: number) => Math.round(n / 500) * 500;

const DIET_SCORE: Record<DietFollowed, number> = { yes: 1, mostly: 0.5, no: 0 };

export type WeekStats = {
  weighIns: number;
  avgWeight: number | null;
  adherencePct: number;
  avgSteps: number | null;
  avgSleep: number | null;
  daysSleepOk: number;
  /** null when there is no step target to compare against */
  daysStepsOk: number | null;
};

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Everything the review needs to know about one Monday–Sunday week. */
export function weekStats(logs: DailyEntry[], weekStart: string, stepTarget: number | null): WeekStats {
  const days = new Set(weekDays(weekStart));
  const rows = logs.filter((l) => days.has(l.log_date));

  const weights = rows.map((r) => r.bodyweight_kg).filter(nonNull);
  const steps = rows.map((r) => r.steps).filter(nonNull);
  const sleeps = rows.map((r) => r.sleep_hours).filter(nonNull);
  // Yes = 1, mostly = ½, no or not logged = 0, out of 7 days.
  const dietPoints = rows.reduce((sum, r) => sum + (r.diet_followed ? DIET_SCORE[r.diet_followed] : 0), 0);

  return {
    weighIns: weights.length,
    avgWeight: weights.length ? mean(weights) : null,
    adherencePct: (dietPoints / 7) * 100,
    avgSteps: steps.length ? mean(steps) : null,
    avgSleep: sleeps.length ? mean(sleeps) : null,
    daysSleepOk: sleeps.filter((h) => h >= SLEEP_GOAL_HOURS).length,
    daysStepsOk: stepTarget === null ? null : steps.filter((s) => s >= stepTarget).length,
  };
}

/** Weeks to review: every Monday after the last reviewed week (or from the first log), up to the last finished week. */
export function pendingWeeks(args: {
  earliestLogDate: string | null;
  lastReviewedWeek: string | null;
  today: string;
}): string[] {
  const { earliestLogDate, lastReviewedWeek, today } = args;
  if (!earliestLogDate) return [];
  const lastFinished = addDays(mondayOf(today), -7);
  let week = lastReviewedWeek ? addDays(lastReviewedWeek, 7) : mondayOf(earliestLogDate);
  const weeks: string[] = [];
  while (week <= lastFinished) {
    weeks.push(week);
    week = addDays(week, 7);
  }
  return weeks;
}

// ----------------------------------------------------------------- ladder

type LadderStep =
  | { kind: "steps" | "calories"; rung: number; targets: Targets; description: string }
  | { kind: "break" };

/** The next rung up the strategy ladder, or a diet break if the ladder is exhausted or blocked by the floor. */
export function nextLadderStep(rung: number, targets: Targets, avgSteps: number | null): LadderStep {
  const next = rung + 1;
  if (next > LADDER_LAST_RUNG) return { kind: "break" };

  if (next === 1 || next === 3) {
    const base =
      next === 1
        ? roundTo500(avgSteps ?? targets.step_target ?? DEFAULT_STEPS_BASE)
        : (targets.step_target ?? roundTo500(avgSteps ?? DEFAULT_STEPS_BASE));
    const step_target = Math.min(MAX_STEP_TARGET, base + STEP_TARGET_INCREASE);
    return {
      kind: "steps",
      rung: next,
      targets: { ...targets, step_target },
      description: `Daily step target is now ${step_target.toLocaleString("en-US")}`,
    };
  }

  // Rungs 2 and 4: a small calorie cut, unless that would go below the floor.
  const calories = targets.calorie_target - CALORIE_STEP;
  if (calories < MIN_CALORIES) return { kind: "break" };
  return {
    kind: "calories",
    rung: next,
    targets: { ...targets, calorie_target: calories },
    description: `Calories lowered by ${CALORIE_STEP} to ${calories.toLocaleString("en-US")}`,
  };
}

// ----------------------------------------------------------------- review

type Habit = { key: string; focus: string; score: number };

function weakestHabit(stats: WeekStats): Habit {
  const habits: Habit[] = [
    { key: "diet", focus: "sticking to your diet", score: stats.adherencePct },
    { key: "weigh_in", focus: "weighing in every morning", score: (stats.weighIns / 7) * 100 },
  ];
  if (stats.daysStepsOk !== null) {
    habits.push({ key: "steps", focus: "hitting your step target", score: (stats.daysStepsOk / 7) * 100 });
  }
  habits.push({ key: "sleep", focus: "getting 7+ hours of sleep", score: (stats.daysSleepOk / 7) * 100 });
  // Strictly lower wins, so a tie keeps the earlier habit in the list.
  return habits.reduce((worst, h) => (h.score < worst.score ? h : worst));
}

const num = (n: number, decimals = 1) => String(Number(n.toFixed(decimals)));
const kcal = (n: number) => n.toLocaleString("en-US");

export function reviewWeek(input: ReviewInput): ReviewResult {
  const { weekStart, logs, wellbeing, targets, previous } = input;
  const ladderRung = previous?.ladder_rung ?? 0;

  const thisStats = weekStats(logs, weekStart, targets.step_target);
  const prevStats = weekStats(logs, addDays(weekStart, -7), targets.step_target);

  const hasData =
    thisStats.weighIns >= MIN_WEIGH_INS &&
    prevStats.weighIns >= MIN_WEIGH_INS &&
    thisStats.avgWeight !== null &&
    prevStats.avgWeight !== null;

  const avgWeight = thisStats.avgWeight === null ? null : round(thisStats.avgWeight, 2);
  const prevAvgWeight = prevStats.avgWeight === null ? null : round(prevStats.avgWeight, 2);
  // Rounded first, so the number you see is the number the rules were applied to.
  const lossRate =
    hasData && avgWeight !== null && prevAvgWeight !== null
      ? round(((prevAvgWeight - avgWeight) / prevAvgWeight) * 100, 2)
      : null;
  const adherence = round(thisStats.adherencePct, 1);

  const inputs: Record<string, unknown> = {
    weigh_ins: thisStats.weighIns,
    prev_weigh_ins: prevStats.weighIns,
    avg_steps: thisStats.avgSteps === null ? null : Math.round(thisStats.avgSteps),
    avg_sleep: thisStats.avgSleep === null ? null : round(thisStats.avgSleep, 1),
    wellbeing_this_week: wellbeing.thisWeek,
    wellbeing_last_week: wellbeing.lastWeek,
    previous_outcome: previous?.outcome ?? null,
  };

  const finish = (
    outcome: ReviewOutcome,
    message: string,
    changes: { targets?: Targets; ladder_rung?: number; extra?: Record<string, unknown> } = {},
  ): ReviewResult => {
    const after = changes.targets ?? targets;
    return {
      week_start: weekStart,
      outcome,
      message,
      avg_weight_kg: avgWeight,
      prev_avg_weight_kg: prevAvgWeight,
      loss_rate_pct: lossRate,
      adherence_pct: adherence,
      ladder_rung: changes.ladder_rung ?? ladderRung,
      calorie_target_before: targets.calorie_target,
      // Final step on every outcome: the floor is applied here, nowhere else.
      calorie_target_after: clampCalories(after.calorie_target),
      step_target_before: targets.step_target,
      step_target_after: after.step_target,
      inputs: { ...inputs, ...changes.extra },
    };
  };

  // 1. SAFETY ---------------------------------------------------------------
  if (lowTwoWeeksRunning(wellbeing.thisWeek, wellbeing.lastWeek)) {
    return finish("diet_break", DIET_BREAK_WELLBEING_MESSAGE, {
      ladder_rung: 0,
      extra: { reason: "wellbeing" },
    });
  }

  if (lossRate !== null && lossRate > LOSS_TOO_FAST_PCT) {
    const calories = targets.calorie_target + CALORIE_STEP;
    return finish(
      "too_fast",
      `You lost ${num(lossRate, 2)}% of your bodyweight this week, faster than is healthy to keep up. ` +
        `Calories go up by ${CALORIE_STEP} to ${kcal(clampCalories(calories))} to protect your energy and muscle.`,
      { targets: { ...targets, calorie_target: calories } },
    );
  }

  if (targets.calorie_target < MIN_CALORIES) {
    return finish(
      "raise_calories",
      `Your calorie target was ${kcal(targets.calorie_target)}. MavernLog never goes below ${kcal(MIN_CALORIES)}, ` +
        `so it's now ${kcal(MIN_CALORIES)}.`,
      { targets: { ...targets, calorie_target: MIN_CALORIES } },
    );
  }

  // 2. NOT ENOUGH DATA ------------------------------------------------------
  if (!hasData) {
    const thisShort = thisStats.weighIns < MIN_WEIGH_INS;
    return finish(
      "insufficient_data",
      thisShort
        ? `Only ${thisStats.weighIns} weigh-in${thisStats.weighIns === 1 ? "" : "s"} this week. ` +
            `Log at least ${MIN_WEIGH_INS} so the average means something. Nothing has changed.`
        : `First full week logged. This is your baseline, so next week there's something to compare it to. Nothing has changed.`,
      { extra: { reason: thisShort ? "too_few_weigh_ins" : "baseline" } },
    );
  }

  // lossRate is non-null from here on.
  const rate = lossRate as number;

  // 3. ADHERENCE ------------------------------------------------------------
  if (adherence < ADHERENCE_MIN_PCT) {
    const habit = weakestHabit(thisStats);
    return finish(
      "simplify",
      `You followed the plan ${num(adherence, 0)}% of the time this week (the goal is ${ADHERENCE_MIN_PCT}%). ` +
        `Nothing changes. Don't add anything new, just focus on one thing: ${habit.focus}.`,
      { extra: { focus_habit: habit.key } },
    );
  }

  // 4. ON TRACK -------------------------------------------------------------
  if (rate >= LOSS_ON_TRACK_MIN_PCT) {
    return finish(
      "on_track",
      `You lost ${num(rate, 2)}% this week (${num(prevAvgWeight as number, 2)} → ${num(avgWeight as number, 2)} kg average). ` +
        `That's on track. Change nothing.`,
    );
  }

  // 5. STALLED (under 0.3%, including gaining) ------------------------------
  const stalledLastWeekToo =
    previous !== null &&
    previous.week_start === addDays(weekStart, -7) &&
    previous.outcome === "stall_watch";

  if (!stalledLastWeekToo) {
    return finish(
      "stall_watch",
      `Weight was flat this week (${num(rate, 2)}%). One slow week is often just water, so nothing changes yet. ` +
        `If next week is flat too, the plan steps up.`,
    );
  }

  const step = nextLadderStep(ladderRung, targets, thisStats.avgSteps);
  if (step.kind === "break") {
    return finish(
      "diet_break",
      `Two flat weeks in a row, and the usual next step would take calories below ${kcal(MIN_CALORIES)}. ` +
        `Time for a 1–2 week diet break at maintenance. Your targets stay as they are, and the ladder starts again afterwards.`,
      { ladder_rung: 0, extra: { reason: "ladder_end" } },
    );
  }

  return finish(
    "ladder_step",
    `Two flat weeks in a row, so it's time for a small step (${step.rung} of ${LADDER_LAST_RUNG}). ${step.description}.`,
    { targets: step.targets, ladder_rung: step.rung, extra: { ladder_action: step.kind } },
  );
}

// --------------------------------------------------------------- sequence

/**
 * Reviews several weeks oldest first. Each review starts from the targets the
 * previous one left behind, which is how a backlog of weeks gets caught up.
 */
export function reviewSequence(args: {
  weeks: string[];
  logs: DailyEntry[];
  wellbeing: WellbeingEntry[];
  initial: Targets;
  previous: PreviousReview | null;
}): { results: ReviewResult[]; final: Targets } {
  const wellbeingFor = (week: string): Wellbeing | null => {
    const w = args.wellbeing.find((c) => c.week_start === week);
    return w ? { mood: w.mood, energy: w.energy, motivation: w.motivation } : null;
  };

  let targets = args.initial;
  let previous = args.previous;
  const results: ReviewResult[] = [];

  for (const week of args.weeks) {
    const result = reviewWeek({
      weekStart: week,
      logs: args.logs,
      wellbeing: { thisWeek: wellbeingFor(week), lastWeek: wellbeingFor(addDays(week, -7)) },
      targets,
      previous,
    });
    results.push(result);
    targets = { calorie_target: result.calorie_target_after, step_target: result.step_target_after };
    previous = {
      week_start: week,
      outcome: result.outcome,
      loss_rate_pct: result.loss_rate_pct,
      ladder_rung: result.ladder_rung,
    };
  }

  return { results, final: targets };
}

import type { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";
import {
  pendingWeeks,
  reviewSequence,
  type DailyEntry,
  type PreviousReview,
  type ReviewOutcome,
  type WellbeingEntry,
} from "@/lib/engine/weeklyReview";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MAX_WEEKS_PER_RUN = 26;

export type ReviewRow = {
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
};

export const REVIEW_COLUMNS =
  "week_start, outcome, message, avg_weight_kg, prev_avg_weight_kg, loss_rate_pct, adherence_pct, ladder_rung, calorie_target_before, calorie_target_after, step_target_before, step_target_after";

const nullableNumber = (v: number | string | null) => (v === null ? null : Number(v));

/** Postgres numerics can come back as strings; make every number a number. */
export function normalizeReview(row: Record<string, unknown>): ReviewRow {
  const r = row as Record<string, number | string | null>;
  return {
    week_start: String(r.week_start),
    outcome: r.outcome as ReviewOutcome,
    message: String(r.message),
    avg_weight_kg: nullableNumber(r.avg_weight_kg),
    prev_avg_weight_kg: nullableNumber(r.prev_avg_weight_kg),
    loss_rate_pct: nullableNumber(r.loss_rate_pct),
    adherence_pct: Number(r.adherence_pct),
    ladder_rung: Number(r.ladder_rung),
    calorie_target_before: Number(r.calorie_target_before),
    calorie_target_after: Number(r.calorie_target_after),
    step_target_before: nullableNumber(r.step_target_before),
    step_target_after: nullableNumber(r.step_target_after),
  };
}

/**
 * Reviews every finished week that hasn't been reviewed yet, oldest first, and
 * saves the new targets to the profile. Safe to call on every page load: it does
 * nothing when there's nothing new, and the unique (user, week) constraint stops
 * two tabs from applying the same week twice.
 */
export async function runPendingReviews(
  supabase: Supabase,
  userId: string,
  today: string,
): Promise<{ ran: number }> {
  const [{ data: profile }, { data: earliest }, { data: latest }] = await Promise.all([
    supabase.from("profiles").select("calorie_target, step_target").maybeSingle(),
    supabase.from("daily_logs").select("log_date").order("log_date").limit(1).maybeSingle(),
    supabase
      .from("weekly_reviews")
      .select("week_start, outcome, loss_rate_pct, ladder_rung")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!profile) return { ran: 0 };

  const candidates = pendingWeeks({
    earliestLogDate: earliest?.log_date ?? null,
    lastReviewedWeek: latest?.week_start ?? null,
    today,
  }).slice(0, MAX_WEEKS_PER_RUN);
  if (candidates.length === 0) return { ran: 0 };

  const from = addDays(candidates[0], -7);
  const to = addDays(candidates[candidates.length - 1], 6);
  const [{ data: logs }, { data: checkins }] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("log_date, bodyweight_kg, steps, sleep_hours, diet_followed")
      .gte("log_date", from)
      .lte("log_date", to)
      .limit(2000),
    supabase
      .from("wellbeing_checkins")
      .select("week_start, mood, energy, motivation")
      .gte("week_start", from)
      .lte("week_start", to),
  ]);

  const dailyLogs: DailyEntry[] = (logs ?? []).map((l) => ({
    log_date: l.log_date,
    bodyweight_kg: nullableNumber(l.bodyweight_kg),
    steps: l.steps,
    sleep_hours: nullableNumber(l.sleep_hours),
    diet_followed: l.diet_followed,
  }));

  // A week with no logs at all has nothing to review, so it's skipped.
  const logged = new Set(dailyLogs.map((l) => l.log_date));
  const weeks = candidates.filter((w) =>
    Array.from({ length: 7 }, (_, i) => addDays(w, i)).some((d) => logged.has(d)),
  );
  if (weeks.length === 0) return { ran: 0 };

  const previous: PreviousReview | null = latest
    ? {
        week_start: latest.week_start,
        outcome: latest.outcome as ReviewOutcome,
        loss_rate_pct: nullableNumber(latest.loss_rate_pct),
        ladder_rung: latest.ladder_rung,
      }
    : null;

  const { results, final } = reviewSequence({
    weeks,
    logs: dailyLogs,
    wellbeing: (checkins ?? []) as WellbeingEntry[],
    initial: { calorie_target: profile.calorie_target, step_target: profile.step_target },
    previous,
  });

  const { error } = await supabase.from("weekly_reviews").insert(
    results.map((r) => ({
      user_id: userId,
      week_start: r.week_start,
      outcome: r.outcome,
      message: r.message,
      avg_weight_kg: r.avg_weight_kg,
      prev_avg_weight_kg: r.prev_avg_weight_kg,
      loss_rate_pct: r.loss_rate_pct,
      adherence_pct: r.adherence_pct,
      ladder_rung: r.ladder_rung,
      calorie_target_before: r.calorie_target_before,
      calorie_target_after: r.calorie_target_after,
      step_target_before: r.step_target_before,
      step_target_after: r.step_target_after,
      inputs: r.inputs,
    })),
  );
  // Most likely another tab got there first. Don't apply the targets twice.
  if (error) return { ran: 0 };

  if (final.calorie_target !== profile.calorie_target || final.step_target !== profile.step_target) {
    await supabase
      .from("profiles")
      .update({ calorie_target: final.calorie_target, step_target: final.step_target })
      .eq("user_id", userId);
  }
  return { ran: results.length };
}

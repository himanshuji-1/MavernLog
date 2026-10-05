/**
 * The one place daily logs and finished workouts are written, shared by the
 * manual forms and the quick log, so both go through the same validated shape.
 */

import type { createClient } from "@/lib/supabase/server";
import type { DailyLogInput } from "@/lib/validation/daily";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Nulls are written on purpose: clearing a field while editing must clear it. */
export async function upsertDailyLog(supabase: Supabase, userId: string, data: DailyLogInput) {
  return supabase.from("daily_logs").upsert(
    { user_id: userId, ...data, updated_at: new Date().toISOString() },
    { onConflict: "user_id,log_date" },
  );
}

export type WorkoutSet = { exercise_id: string; weight_kg: number; reps: number; rir: number };

/** Saves a complete, already-finished workout. All-or-nothing: a failed set insert removes the session. */
export async function insertFinishedWorkout(
  supabase: Supabase,
  userId: string,
  performedOn: string,
  sets: WorkoutSet[],
): Promise<{ ok: boolean }> {
  const now = new Date().toISOString();
  const { data: session, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: userId, performed_on: performedOn, started_at: now, finished_at: now })
    .select("id")
    .single();
  if (error || !session) return { ok: false };

  // Set numbers count up per exercise, in the order given.
  const counts = new Map<string, number>();
  const rows = sets.map((s) => {
    const n = (counts.get(s.exercise_id) ?? 0) + 1;
    counts.set(s.exercise_id, n);
    return { user_id: userId, session_id: session.id, set_number: n, ...s };
  });

  const { error: setsError } = await supabase.from("workout_sets").insert(rows);
  if (setsError) {
    await supabase.from("workout_sessions").delete().eq("id", session.id);
    return { ok: false };
  }
  return { ok: true };
}

import type { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";
import { fetchAll } from "@/lib/supabase/paginate";
import { sessionsForExercise, type HistoryRow } from "@/lib/engine/history";
import { nextTarget, type BodyRegion, type Target } from "@/lib/engine/progression";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** How far back history is read. A miss streak older than this no longer matters. */
export const HISTORY_DAYS = 120;

export type Exercise = {
  id: string;
  name: string;
  body_region: BodyRegion;
  target_sets: number;
  target_reps: number;
  archived: boolean;
  sort_order: number;
};

export const EXERCISE_COLUMNS = "id, name, body_region, target_sets, target_reps, archived, sort_order";

export async function loadExercises(supabase: Supabase): Promise<Exercise[]> {
  const { data } = await supabase
    .from("exercises")
    .select(EXERCISE_COLUMNS)
    .order("sort_order")
    .order("name");
  return (data ?? []) as Exercise[];
}

type RawRow = {
  session_id: string;
  exercise_id: string;
  weight_kg: number;
  reps: number;
  rir: number;
  workout_sessions:
    | { performed_on: string; started_at: string }
    | { performed_on: string; started_at: string }[]
    | null;
};

/**
 * Every logged set in the last `sinceDays` days (or all of them with null),
 * flattened with its session's date.
 */
export async function loadHistory(
  supabase: Supabase,
  today: string,
  sinceDays: number | null = HISTORY_DAYS,
): Promise<HistoryRow[]> {
  const since = sinceDays === null ? null : addDays(today, -sinceDays);

  const data = await fetchAll<RawRow>((from, to) => {
    const query = supabase
      .from("workout_sets")
      .select(
        "session_id, exercise_id, weight_kg, reps, rir, workout_sessions!inner(performed_on, started_at)",
      );
    return (since === null ? query : query.gte("workout_sessions.performed_on", since))
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: RawRow[] | null; error: unknown }>;
  });

  const rows: HistoryRow[] = [];
  for (const raw of data) {
    const session = Array.isArray(raw.workout_sessions)
      ? raw.workout_sessions[0]
      : raw.workout_sessions;
    if (!session) continue;
    rows.push({
      session_id: raw.session_id,
      performed_on: session.performed_on,
      started_at: session.started_at,
      exercise_id: raw.exercise_id,
      weight_kg: Number(raw.weight_kg),
      reps: raw.reps,
      rir: raw.rir,
    });
  }
  return rows;
}

/** Next-session target for each exercise, keyed by exercise id. */
export function targetsFor(
  exercises: Exercise[],
  history: HistoryRow[],
  excludeSessionId?: string,
): Map<string, Target> {
  return new Map(
    exercises.map((e) => [e.id, nextTarget(e, sessionsForExercise(history, e.id, excludeSessionId))]),
  );
}

/** Exercise ids used in the most recent session, newest first by date then start time. */
export function lastWorkoutExerciseIds(history: HistoryRow[]): string[] {
  let latest: HistoryRow | null = null;
  for (const row of history) {
    if (
      !latest ||
      row.performed_on > latest.performed_on ||
      (row.performed_on === latest.performed_on && row.started_at > latest.started_at)
    ) {
      latest = row;
    }
  }
  if (!latest) return [];
  return [
    ...new Set(history.filter((r) => r.session_id === latest.session_id).map((r) => r.exercise_id)),
  ];
}

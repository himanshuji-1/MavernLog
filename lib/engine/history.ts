import type { SessionLog } from "./progression";

/** One logged set, flattened with its session's info (as read from the database). */
export type HistoryRow = {
  session_id: string;
  performed_on: string;
  started_at: string;
  exercise_id: string;
  weight_kg: number;
  reps: number;
  rir: number;
};

/**
 * One exercise's sets grouped into sessions, oldest first (by date, then by
 * when the session was started), never by row order.
 */
export function sessionsForExercise(
  rows: HistoryRow[],
  exerciseId: string,
  excludeSessionId?: string,
): SessionLog[] {
  const sessions = new Map<string, { date: string; started: string; sets: SessionLog["sets"] }>();

  for (const row of rows) {
    if (row.exercise_id !== exerciseId || row.session_id === excludeSessionId) continue;
    const session = sessions.get(row.session_id) ?? {
      date: row.performed_on,
      started: row.started_at,
      sets: [],
    };
    session.sets.push({ weight_kg: row.weight_kg, reps: row.reps, rir: row.rir });
    sessions.set(row.session_id, session);
  }

  return [...sessions.values()]
    .sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.started < b.started ? -1 : a.started > b.started ? 1 : 0,
    )
    .map(({ date, sets }) => ({ date, sets }));
}

import { describe, expect, it } from "vitest";
import { sessionsForExercise, type HistoryRow } from "../history";

const row = (
  session_id: string,
  performed_on: string,
  exercise_id: string,
  weight_kg: number,
  started_at = `${performed_on}T10:00:00Z`,
): HistoryRow => ({ session_id, performed_on, started_at, exercise_id, weight_kg, reps: 5, rir: 2 });

describe("sessionsForExercise", () => {
  it("only includes the requested exercise", () => {
    const rows = [row("s1", "2026-10-01", "bench", 60), row("s1", "2026-10-01", "squat", 100)];
    const sessions = sessionsForExercise(rows, "bench");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sets.map((s) => s.weight_kg)).toEqual([60]);
  });

  it("groups sets into one session per session id", () => {
    const rows = [
      row("s1", "2026-10-01", "bench", 60),
      row("s1", "2026-10-01", "bench", 60),
      row("s2", "2026-10-03", "bench", 62.5),
    ];
    expect(sessionsForExercise(rows, "bench").map((s) => s.sets.length)).toEqual([2, 1]);
  });

  it("sorts by date, not by row order", () => {
    const rows = [
      row("late", "2026-10-09", "bench", 65),
      row("early", "2026-10-01", "bench", 60),
      row("mid", "2026-10-05", "bench", 62.5),
    ];
    expect(sessionsForExercise(rows, "bench").map((s) => s.date)).toEqual([
      "2026-10-01",
      "2026-10-05",
      "2026-10-09",
    ]);
  });

  it("orders two sessions on the same day by when they started", () => {
    const rows = [
      row("evening", "2026-10-01", "bench", 65, "2026-10-01T18:00:00Z"),
      row("morning", "2026-10-01", "bench", 60, "2026-10-01T08:00:00Z"),
    ];
    const weights = sessionsForExercise(rows, "bench").map((s) => s.sets[0].weight_kg);
    expect(weights).toEqual([60, 65]);
  });

  it("can leave out the session currently being logged", () => {
    const rows = [row("s1", "2026-10-01", "bench", 60), row("current", "2026-10-05", "bench", 62.5)];
    expect(sessionsForExercise(rows, "bench", "current")).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  deloadWeight,
  nextTarget,
  sessionOutcome,
  type ExerciseConfig,
  type SessionLog,
} from "../progression";

const upper: ExerciseConfig = { body_region: "upper", target_sets: 3, target_reps: 5 };
const lower: ExerciseConfig = { body_region: "lower", target_sets: 3, target_reps: 5 };

/** 3×5 at the given weight and RIR: a clean "hit" when rir ≤ 2. */
const clean = (date: string, weight: number, rir = 2): SessionLog => ({
  date,
  sets: [1, 2, 3].map(() => ({ weight_kg: weight, reps: 5, rir })),
});

/** 5, 5, then 4 reps: a "miss". */
const missed = (date: string, weight: number): SessionLog => ({
  date,
  sets: [
    { weight_kg: weight, reps: 5, rir: 1 },
    { weight_kg: weight, reps: 5, rir: 0 },
    { weight_kg: weight, reps: 4, rir: 0 },
  ],
});

describe("sessionOutcome", () => {
  it("hit: all sets at target reps with RIR ≤ 2", () => {
    expect(sessionOutcome(clean("2026-10-01", 60), upper)).toBe("hit");
    expect(sessionOutcome(clean("2026-10-01", 60, 0), upper)).toBe("hit");
  });

  it("miss: any set under target reps", () => {
    expect(sessionOutcome(missed("2026-10-01", 60), upper)).toBe("miss");
  });

  it("hold: reps hit but RIR above 2", () => {
    expect(sessionOutcome(clean("2026-10-01", 60, 3), upper)).toBe("hold");
  });

  it("hold: fewer sets than the target were done", () => {
    const session: SessionLog = { date: "2026-10-01", sets: [{ weight_kg: 60, reps: 5, rir: 1 }] };
    expect(sessionOutcome(session, upper)).toBe("hold");
  });

  it("extra reps beyond the target still count as hitting it", () => {
    const session: SessionLog = {
      date: "2026-10-01",
      sets: [1, 2, 3].map(() => ({ weight_kg: 60, reps: 8, rir: 2 })),
    };
    expect(sessionOutcome(session, upper)).toBe("hit");
  });
});

describe("nextTarget: starting out", () => {
  it("asks for a starting weight when there is no history", () => {
    const t = nextTarget(upper, []);
    expect(t.action).toBe("start");
    expect(t.weight_kg).toBeNull();
    expect(t.sets).toBe(3);
    expect(t.reps).toBe(5);
  });

  it("ignores sessions with no sets", () => {
    expect(nextTarget(upper, [{ date: "2026-10-01", sets: [] }]).action).toBe("start");
  });
});

describe("nextTarget: progression", () => {
  it("upper body hit → +2.5 kg", () => {
    const t = nextTarget(upper, [clean("2026-10-01", 60)]);
    expect(t).toMatchObject({ action: "increase", weight_kg: 62.5 });
    expect(t.reason).toContain("+2.5 kg");
  });

  it("lower body hit → +5 kg", () => {
    const t = nextTarget(lower, [clean("2026-10-01", 100, 1)]);
    expect(t).toMatchObject({ action: "increase", weight_kg: 105 });
    expect(t.reason).toContain("+5 kg");
  });

  it("works from the heaviest set when weights vary within a session", () => {
    const session: SessionLog = {
      date: "2026-10-01",
      sets: [
        { weight_kg: 60, reps: 5, rir: 2 },
        { weight_kg: 62.5, reps: 5, rir: 2 },
        { weight_kg: 60, reps: 5, rir: 2 },
      ],
    };
    expect(nextTarget(upper, [session]).weight_kg).toBe(65);
  });

  it("all reps hit at RIR 3 → hold the weight", () => {
    const t = nextTarget(upper, [clean("2026-10-01", 60, 3)]);
    expect(t).toMatchObject({ action: "hold", weight_kg: 60 });
    expect(t.reason).toContain("RIR was 3");
  });

  it("one miss → hold the weight", () => {
    const t = nextTarget(upper, [clean("2026-10-01", 60), missed("2026-10-03", 62.5)]);
    expect(t).toMatchObject({ action: "hold", weight_kg: 62.5 });
  });

  it("an unfinished session → hold the weight", () => {
    const partial: SessionLog = { date: "2026-10-01", sets: [{ weight_kg: 60, reps: 5, rir: 1 }] };
    expect(nextTarget(upper, [partial])).toMatchObject({ action: "hold", weight_kg: 60 });
  });
});

describe("nextTarget: deload after two misses in a row", () => {
  it("two misses in a row → about −7%, rounded down to 2.5 kg (100 → 92.5)", () => {
    const t = nextTarget(lower, [missed("2026-10-01", 100), missed("2026-10-03", 100)]);
    expect(t).toMatchObject({ action: "deload", weight_kg: 92.5 });
    expect(t.reason).toContain("92.5 kg");
  });

  it("miss, hit, miss is not consecutive → hold", () => {
    const t = nextTarget(upper, [
      missed("2026-10-01", 60),
      clean("2026-10-03", 60),
      missed("2026-10-05", 62.5),
    ]);
    expect(t.action).toBe("hold");
  });

  it("miss, hold (too easy), miss is not consecutive → hold", () => {
    const t = nextTarget(upper, [
      missed("2026-10-01", 60),
      clean("2026-10-03", 60, 3),
      missed("2026-10-05", 60),
    ]);
    expect(t.action).toBe("hold");
  });

  it("the streak resets after the drop: a further miss only holds", () => {
    const t = nextTarget(upper, [
      missed("2026-10-01", 60),
      missed("2026-10-03", 60), // triggers the deload…
      missed("2026-10-06", 55), // …one more miss at the lighter weight
    ]);
    expect(t).toMatchObject({ action: "hold", weight_kg: 55 });
  });

  it("two more misses after a drop trigger another drop", () => {
    const t = nextTarget(upper, [
      missed("2026-10-01", 60),
      missed("2026-10-03", 60),
      missed("2026-10-06", 55),
      missed("2026-10-08", 55),
    ]);
    expect(t).toMatchObject({ action: "deload", weight_kg: 50 }); // 55 × 0.93 = 51.15 → 50
  });

  it("progresses normally after a successful deload session", () => {
    const t = nextTarget(upper, [
      missed("2026-10-01", 60),
      missed("2026-10-03", 60),
      clean("2026-10-06", 55),
    ]);
    expect(t).toMatchObject({ action: "increase", weight_kg: 57.5 });
  });
});

describe("nextTarget: input ordering", () => {
  it("orders sessions by date, not by the order they were passed in", () => {
    const newest = clean("2026-10-10", 70);
    const oldest = missed("2026-10-01", 60);
    const middle = missed("2026-10-05", 60);
    // Shuffled: the true order is oldest, middle (2 misses → deload), newest (hit).
    const t = nextTarget(upper, [newest, oldest, middle]);
    expect(t).toMatchObject({ action: "increase", weight_kg: 72.5 });
  });

  it("does not mutate the sessions array it was given", () => {
    const input = [clean("2026-10-10", 70), clean("2026-10-01", 60)];
    nextTarget(upper, input);
    expect(input.map((s) => s.date)).toEqual(["2026-10-10", "2026-10-01"]);
  });
});

describe("deloadWeight", () => {
  it.each([
    [100, 92.5],
    [60, 55],
    [80, 72.5],
    [2.5, 2.5], // never below one step
    [20, 17.5],
  ])("%s kg → %s kg", (from, to) => {
    expect(deloadWeight(from)).toBe(to);
  });

  it("is always a multiple of 2.5 and never heavier than before", () => {
    for (let w = 2.5; w <= 400; w += 2.5) {
      const d = deloadWeight(w);
      expect(d % 2.5).toBe(0);
      expect(d).toBeLessThanOrEqual(w);
    }
  });
});

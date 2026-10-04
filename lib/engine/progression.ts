/**
 * Workout progression: what to lift next session, from past sessions only.
 * Pure functions: no database, no dates from the clock, no AI.
 */

export type BodyRegion = "upper" | "lower";

export type SetLog = { weight_kg: number; reps: number; rir: number };

/** All working sets of one exercise in one session. */
export type SessionLog = { date: string; sets: SetLog[] };

export type ExerciseConfig = {
  body_region: BodyRegion;
  target_sets: number;
  target_reps: number;
};

export type TargetAction = "start" | "increase" | "hold" | "deload";

export type Target = {
  action: TargetAction;
  /** null only when there is no history: the user picks a starting weight. */
  weight_kg: number | null;
  sets: number;
  reps: number;
  /** Plain-language explanation, shown on the target card. */
  reason: string;
};

export type SessionOutcome = "hit" | "miss" | "hold";

export const INCREMENT_KG: Record<BodyRegion, number> = { upper: 2.5, lower: 5 };
export const PLATE_STEP_KG = 2.5;
export const DELOAD_FACTOR = 0.93;
export const MAX_RIR_FOR_HIT = 2;
const MISSES_BEFORE_DELOAD = 2;

/**
 * hit  = every set reached the target reps at RIR ≤ 2, and all target sets were done
 * miss = at least one set fell short of the target reps
 * hold = reps were hit but it was too easy (RIR > 2) or sets were left unfinished
 */
export function sessionOutcome(session: SessionLog, config: ExerciseConfig): SessionOutcome {
  const { sets } = session;
  if (sets.some((s) => s.reps < config.target_reps)) return "miss";
  if (sets.length >= config.target_sets && sets.every((s) => s.rir <= MAX_RIR_FOR_HIT)) {
    return "hit";
  }
  return "hold";
}

/** The working weight of a session: its heaviest set. */
export function topWeight(sets: SetLog[]): number {
  return Math.max(...sets.map((s) => s.weight_kg));
}

/** About −7%, rounded down to the nearest 2.5 kg (never below one step). */
export function deloadWeight(weightKg: number): number {
  const steps = Math.floor((weightKg * DELOAD_FACTOR) / PLATE_STEP_KG + 1e-9);
  return Math.max(PLATE_STEP_KG, steps * PLATE_STEP_KG);
}

const kg = (n: number) => `${Number(n.toFixed(2))} kg`;

export function nextTarget(config: ExerciseConfig, sessions: SessionLog[]): Target {
  const base = { sets: config.target_sets, reps: config.target_reps };

  // Oldest → newest. Array.sort is stable, so same-day sessions keep their order.
  const history = sessions
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (history.length === 0) {
    return {
      ...base,
      action: "start",
      weight_kg: null,
      reason: "No history yet. Pick a starting weight you can do for all reps with 2+ reps in reserve.",
    };
  }

  // Walk the history, counting consecutive misses. Two in a row triggers a
  // deload, and the streak resets so the same misses never trigger twice.
  let streak = 0;
  let lastOutcome: SessionOutcome = "hold";
  let lastTriggeredDeload = false;
  for (const session of history) {
    lastOutcome = sessionOutcome(session, config);
    streak = lastOutcome === "miss" ? streak + 1 : 0;
    lastTriggeredDeload = streak >= MISSES_BEFORE_DELOAD;
    if (lastTriggeredDeload) streak = 0;
  }

  const lastSets = history[history.length - 1].sets;
  const last = topWeight(lastSets);

  if (lastTriggeredDeload) {
    const weight = deloadWeight(last);
    return {
      ...base,
      action: "deload",
      weight_kg: weight,
      reason: `Missed reps 2 sessions in a row → drop about 7% to ${kg(weight)}`,
    };
  }

  if (lastOutcome === "hit") {
    const inc = INCREMENT_KG[config.body_region];
    return {
      ...base,
      action: "increase",
      weight_kg: last + inc,
      reason: `Hit ${config.target_sets}×${config.target_reps} at RIR ≤ ${MAX_RIR_FOR_HIT} → +${kg(inc)}`,
    };
  }

  if (lastOutcome === "miss") {
    return {
      ...base,
      action: "hold",
      weight_kg: last,
      reason: `Missed reps last time → repeat ${kg(last)}`,
    };
  }

  const worstRir = Math.max(...lastSets.map((s) => s.rir));
  const reason =
    lastSets.every((s) => s.rir <= MAX_RIR_FOR_HIT)
      ? `Not all ${config.target_sets} sets were done → repeat ${kg(last)}`
      : `Reps hit but RIR was ${worstRir} (needs ${MAX_RIR_FOR_HIT} or lower) → stay at ${kg(last)}`;
  return { ...base, action: "hold", weight_kg: last, reason };
}

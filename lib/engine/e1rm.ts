/**
 * Estimated one-rep max, Epley formula: weight × (1 + reps / 30).
 * A single rep is the lift itself, so it returns the weight unchanged.
 */
export function epley(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new RangeError(`weight must be 0 or more, got ${weightKg}`);
  }
  if (!Number.isFinite(reps) || reps < 1) {
    throw new RangeError(`reps must be at least 1, got ${reps}`);
  }
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** The best e1RM across a session's sets, or null if there are none. */
export function bestE1rm(sets: { weight_kg: number; reps: number }[]): number | null {
  if (sets.length === 0) return null;
  return Math.max(...sets.map((s) => epley(s.weight_kg, s.reps)));
}

export type DefaultExercise = {
  name: string;
  body_region: "upper" | "lower";
  target_sets: number;
  target_reps: number;
};

/** Copied into each new user's own exercise list at onboarding. */
export const DEFAULT_EXERCISES: DefaultExercise[] = [
  { name: "Squat", body_region: "lower", target_sets: 3, target_reps: 5 },
  { name: "Bench Press", body_region: "upper", target_sets: 3, target_reps: 5 },
  { name: "Deadlift", body_region: "lower", target_sets: 1, target_reps: 5 },
  { name: "Overhead Press", body_region: "upper", target_sets: 3, target_reps: 5 },
  { name: "Barbell Row", body_region: "upper", target_sets: 3, target_reps: 8 },
  { name: "Romanian Deadlift", body_region: "lower", target_sets: 3, target_reps: 8 },
  { name: "Lat Pulldown", body_region: "upper", target_sets: 3, target_reps: 10 },
  { name: "Leg Press", body_region: "lower", target_sets: 3, target_reps: 10 },
];

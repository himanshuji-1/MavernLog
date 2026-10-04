import { z } from "zod";
import { requiredRange, range } from "./shared";

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Name must be 60 characters or fewer"),
  body_region: z.enum(["upper", "lower"], { error: "Pick upper or lower body" }),
  target_sets: range("Sets", "", 1, 10).int("Sets must be a whole number"),
  target_reps: range("Reps", "", 1, 30).int("Reps must be a whole number"),
});

export const setSchema = z.object({
  session_id: z.uuid(),
  exercise_id: z.uuid(),
  set_number: range("Set number", "", 1, 30).int(),
  weight_kg: requiredRange("Weight", " kg", 0, 1000, "Enter a weight"),
  reps: requiredRange("Reps", "", 1, 100, "Enter your reps").pipe(z.number().int("Reps must be a whole number")),
  rir: requiredRange("RIR", "", 0, 5, "Pick your RIR").pipe(z.number().int("RIR must be a whole number")),
});

export type SetInput = z.infer<typeof setSchema>;

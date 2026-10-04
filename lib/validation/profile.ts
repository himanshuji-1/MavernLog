import { z } from "zod";

export const MIN_SAFE_CALORIES = 1800;

function range(label: string, unit: string, min: number, max: number) {
  const message = `${label} must be between ${min} and ${max}${unit}`;
  return z.coerce.number({ error: message }).min(min, message).max(max, message);
}

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const onboardingSchema = z
  .object({
    height_cm: range("Height", " cm", 100, 250),
    start_weight_kg: range("Weight", " kg", 30, 300),
    goal_weight_kg: range("Goal weight", " kg", 30, 300),
    calorie_target: range("Calories", " kcal", 1000, 6000).int(
      "Calories must be a whole number",
    ),
    protein_target_g: range("Protein", " g", 40, 400).int(
      "Protein must be a whole number",
    ),
    timezone: z
      .string()
      .refine(isValidTimeZone, "Unknown timezone")
      .catch("UTC"),
  })
  .refine((d) => d.goal_weight_kg < d.start_weight_kg, {
    path: ["goal_weight_kg"],
    message: "Goal weight must be below your current weight",
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;

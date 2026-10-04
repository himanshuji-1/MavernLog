import { z } from "zod";
import { isoDate, optional, range } from "./shared";

export const DIET_OPTIONS = ["yes", "mostly", "no"] as const;

export const dailyLogSchema = z
  .object({
    log_date: isoDate,
    bodyweight_kg: optional(range("Weight", " kg", 30, 300)),
    steps: optional(range("Steps", "", 0, 100000).int("Steps must be a whole number")),
    sleep_hours: optional(range("Sleep", " hours", 0, 24)),
    diet_followed: optional(z.enum(DIET_OPTIONS, { error: "Pick yes, mostly or no" })),
    hunger: optional(range("Hunger", "", 1, 5).int("Hunger must be 1 to 5")),
  })
  .refine(
    (d) =>
      d.bodyweight_kg !== null ||
      d.steps !== null ||
      d.sleep_hours !== null ||
      d.diet_followed !== null ||
      d.hunger !== null,
    { path: ["form"], message: "Enter at least one value before saving" },
  );

export type DailyLogInput = z.infer<typeof dailyLogSchema>;

const score = (label: string) =>
  range(label, "", 1, 5).int(`${label} must be 1 to 5`);

export const wellbeingSchema = z.object({
  mood: score("Mood"),
  energy: score("Energy"),
  motivation: score("Motivation"),
});

export type WellbeingInput = z.infer<typeof wellbeingSchema>;

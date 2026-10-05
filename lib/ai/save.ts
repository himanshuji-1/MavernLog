import { z } from "zod";
import { DAILY_KEYS } from "./quicklog";
import { isoDate } from "@/lib/validation/shared";
import { setSchema } from "@/lib/validation/workout";

/** What the confirm card sends back when the user taps Save. Everything is a string, like a form. */
export const quickLogPayloadSchema = z.strictObject({
  date: isoDate,
  as_of: z.string().max(10).nullable(),
  daily: z.partialRecord(z.enum(DAILY_KEYS), z.string().max(20)),
  sets: z
    .array(
      z.strictObject({
        exercise_id: z.string().max(40),
        weight_kg: z.string().max(10),
        reps: z.string().max(10),
        rir: z.string().max(10),
      }),
    )
    .max(40),
});

export type QuickLogPayload = z.infer<typeof quickLogPayloadSchema>;

/** Same rules as the manual set form, minus the ids the server assigns. */
export const quickSetSchema = setSchema.pick({
  exercise_id: true,
  weight_kg: true,
  reps: true,
  rir: true,
});

export type QuickLogResult =
  | { ok: true; saved: { daily: boolean; sets: number } }
  | { ok: false; message?: string; fieldErrors?: Record<string, string> };

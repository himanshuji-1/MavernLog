import { z } from "zod";

/** A number coerced from a form string, with one clear message for every failure. */
export function range(label: string, unit: string, min: number, max: number) {
  const message = `${label} must be between ${min} and ${max}${unit}`;
  return z.coerce.number({ error: message }).min(min, message).max(max, message);
}

/** Like range(), but an empty field is an error ("Enter a weight") instead of 0. */
export function requiredRange(label: string, unit: string, min: number, max: number, prompt: string) {
  const message = `${label} must be between ${min} and ${max}${unit}`;
  return z
    .string({ error: prompt })
    .trim()
    .min(1, prompt)
    .transform(Number)
    .pipe(z.number({ error: message }).min(min, message).max(max, message));
}

/** Empty form fields arrive as "" — treat them as "not provided". */
export function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    schema.nullable(),
  );
}

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

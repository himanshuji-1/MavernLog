import { z } from "zod";

/** A number coerced from a form string, with one clear message for every failure. */
export function range(label: string, unit: string, min: number, max: number) {
  const message = `${label} must be between ${min} and ${max}${unit}`;
  return z.coerce.number({ error: message }).min(min, message).max(max, message);
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

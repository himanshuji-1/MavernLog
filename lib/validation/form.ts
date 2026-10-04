import type { z } from "zod";

/** What every form server action returns, so forms can re-show input + errors. */
export type FormState = {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  saved?: boolean;
} | null;

export function formToValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

/** First message per field; errors on the whole form land under "form". */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  return fieldErrors;
}

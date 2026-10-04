"use server";

import { redirect } from "next/navigation";
import { DEFAULT_EXERCISES } from "@/lib/default-exercises";
import { createClient, getUserId } from "@/lib/supabase/server";
import { formToValues, zodFieldErrors, type FormState } from "@/lib/validation/form";
import { onboardingSchema } from "@/lib/validation/profile";

export async function completeOnboarding(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formToValues(formData);

  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  // Exercises first, profile last: the profile row is what marks the user as
  // onboarded, so a failure part-way leaves them safely able to retry.
  const { error: exerciseError } = await supabase.from("exercises").upsert(
    DEFAULT_EXERCISES.map((e, i) => ({ ...e, user_id: userId, sort_order: i })),
    { onConflict: "user_id,name", ignoreDuplicates: true },
  );
  if (exerciseError) {
    return {
      values,
      fieldErrors: {},
      formError: "Couldn't save your setup. Please try again.",
    };
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    { user_id: userId, ...parsed.data },
    { onConflict: "user_id" },
  );
  if (profileError) {
    return {
      values,
      fieldErrors: {},
      formError: "Couldn't save your setup. Please try again.",
    };
  }

  redirect("/today");
}

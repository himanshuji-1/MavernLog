"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isWithinLastDays, wellbeingTargetWeek } from "@/lib/dates";
import { upsertDailyLog } from "@/lib/server/records";
import { createClient, getUserId } from "@/lib/supabase/server";
import { resolveToday } from "@/lib/today";
import { dailyLogSchema, wellbeingSchema } from "@/lib/validation/daily";
import { formToValues, zodFieldErrors, type FormState } from "@/lib/validation/form";

const SAVE_ERROR = "Couldn't save. Please try again.";

async function currentUser() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  return { supabase, userId, timezone: profile.timezone };
}

export async function saveDailyLog(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formToValues(formData);
  const parsed = dailyLogSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const { supabase, userId, timezone } = await currentUser();
  const today = resolveToday(timezone, values.as_of);
  if (!isWithinLastDays(parsed.data.log_date, today, 7)) {
    return { values, fieldErrors: { form: "You can only log the last 7 days." } };
  }

  const { error } = await upsertDailyLog(supabase, userId, parsed.data);
  if (error) return { values, fieldErrors: {}, formError: SAVE_ERROR };

  revalidatePath("/today");
  return { values, fieldErrors: {}, saved: true };
}

export async function saveWellbeing(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formToValues(formData);
  const parsed = wellbeingSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const { supabase, userId, timezone } = await currentUser();
  // The week is decided here, never taken from the client.
  const weekStart = wellbeingTargetWeek(resolveToday(timezone, values.as_of));
  if (!weekStart) {
    return { values, fieldErrors: {}, formError: "The weekly check-in opens on Sunday." };
  }

  const { error } = await supabase.from("wellbeing_checkins").upsert(
    { user_id: userId, week_start: weekStart, ...parsed.data },
    { onConflict: "user_id,week_start" },
  );
  if (error) return { values, fieldErrors: {}, formError: SAVE_ERROR };

  revalidatePath("/today");
  return { values, fieldErrors: {}, saved: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isWithinLastDays } from "@/lib/dates";
import { quickLogPayloadSchema, quickSetSchema, type QuickLogResult } from "@/lib/ai/save";
import { DAILY_KEYS } from "@/lib/ai/quicklog";
import { insertFinishedWorkout, upsertDailyLog, type WorkoutSet } from "@/lib/server/records";
import { createClient, getUserId } from "@/lib/supabase/server";
import { resolveToday } from "@/lib/today";
import { dailyLogSchema, type DailyLogInput } from "@/lib/validation/daily";

const GENERIC = "Something went wrong. Please try again.";

/**
 * Saves a CONFIRMED quick-log draft. Runs the same validation as the manual
 * forms. Nothing is written unless every field passes: all or nothing.
 */
export async function saveQuickLog(input: unknown): Promise<QuickLogResult> {
  const payload = quickLogPayloadSchema.safeParse(input);
  if (!payload.success) return { ok: false, message: GENERIC };
  const { date, as_of, daily, sets } = payload.data;

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("timezone").maybeSingle();
  if (!profile) redirect("/onboarding");

  const fieldErrors: Record<string, string> = {};

  if (!isWithinLastDays(date, resolveToday(profile.timezone, as_of), 7)) {
    fieldErrors.date = "You can only log the last 7 days.";
  }

  // ---- daily log: merge onto what's already saved that day, so "slept 7 hours"
  // never wipes out a weight and steps logged earlier.
  const provided = DAILY_KEYS.filter((k) => (daily[k] ?? "").trim() !== "");
  let dailyData: DailyLogInput | null = null;
  if (provided.length > 0) {
    const { data: existing } = await supabase
      .from("daily_logs")
      .select("bodyweight_kg, steps, sleep_hours, diet_followed, hunger")
      .eq("log_date", date)
      .maybeSingle();

    const merged: Record<string, string> = { log_date: date };
    for (const key of DAILY_KEYS) {
      const saved = existing?.[key];
      merged[key] = saved === null || saved === undefined ? "" : String(saved);
      if (provided.includes(key)) merged[key] = (daily[key] ?? "").trim();
    }
    const parsed = dailyLogSchema.safeParse(merged);
    if (parsed.success) {
      dailyData = parsed.data;
    } else {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        fieldErrors[(DAILY_KEYS as readonly string[]).includes(key) ? `daily.${key}` : "form"] ??= issue.message;
      }
    }
  }

  // ---- workout sets
  const setData: WorkoutSet[] = [];
  sets.forEach((s, i) => {
    if (s.exercise_id.trim() === "") fieldErrors[`sets.${i}.exercise_id`] = "Pick an exercise";
    const parsed = quickSetSchema.safeParse(s);
    if (parsed.success) {
      setData.push(parsed.data);
    } else {
      for (const issue of parsed.error.issues) {
        fieldErrors[`sets.${i}.${String(issue.path[0])}`] ??= issue.message;
      }
    }
  });

  // Every exercise must be the user's own (RLS hides everyone else's).
  const ids = [...new Set(setData.map((s) => s.exercise_id))];
  if (ids.length > 0) {
    const { data: owned } = await supabase.from("exercises").select("id").in("id", ids);
    sets.forEach((s, i) => {
      if (ids.includes(s.exercise_id) && !owned?.some((o) => o.id === s.exercise_id)) {
        fieldErrors[`sets.${i}.exercise_id`] = "Pick an exercise";
      }
    });
  }

  if (provided.length === 0 && sets.length === 0) return { ok: false, message: "There's nothing to save." };
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // ---- write
  if (dailyData) {
    const { error } = await upsertDailyLog(supabase, userId, dailyData);
    if (error) return { ok: false, message: GENERIC };
  }
  if (setData.length > 0) {
    const { ok } = await insertFinishedWorkout(supabase, userId, date, setData);
    if (!ok) {
      return {
        ok: false,
        message: dailyData
          ? "Your daily log was saved, but the workout wasn't. Please try the workout again."
          : GENERIC,
      };
    }
  }

  revalidatePath("/today");
  revalidatePath("/workout");
  revalidatePath("/progress");
  return { ok: true, saved: { daily: dailyData !== null, sets: setData.length } };
}

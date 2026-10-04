"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getUserId } from "@/lib/supabase/server";
import { resolveToday } from "@/lib/today";
import { formToValues, zodFieldErrors, type FormState } from "@/lib/validation/form";
import { setSchema } from "@/lib/validation/workout";

const SAVE_ERROR = "Couldn't save. Please try again.";

async function currentUser() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");
  return { supabase, userId };
}

export async function startWorkout(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formToValues(formData);
  const ids = z.array(z.uuid()).safeParse(formData.getAll("exercise"));
  if (!ids.success || ids.data.length === 0) {
    return { values, fieldErrors: {}, formError: "Pick at least one exercise." };
  }

  const { supabase, userId } = await currentUser();
  const { data: profile } = await supabase.from("profiles").select("timezone").maybeSingle();
  if (!profile) redirect("/onboarding");

  // Only the user's own, non-archived exercises can be chosen (RLS hides the rest).
  const { data: owned } = await supabase
    .from("exercises")
    .select("id")
    .in("id", ids.data)
    .eq("archived", false);
  const valid = ids.data.filter((id) => owned?.some((o) => o.id === id));
  if (valid.length === 0) {
    return { values, fieldErrors: {}, formError: "Those exercises aren't available." };
  }

  const { data: session, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      performed_on: resolveToday(profile.timezone, values.as_of),
    })
    .select("id")
    .single();
  if (error || !session) return { values, fieldErrors: {}, formError: SAVE_ERROR };

  redirect(`/workout/${session.id}?ex=${valid.join(",")}`);
}

export async function saveSet(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formToValues(formData);
  const parsed = setSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const { supabase, userId } = await currentUser();

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("finished_at")
    .eq("id", parsed.data.session_id)
    .maybeSingle();
  if (!session) return { values, fieldErrors: {}, formError: "Workout not found." };
  if (session.finished_at) {
    return { values, fieldErrors: {}, formError: "This workout is already finished." };
  }

  const { error } = await supabase.from("workout_sets").upsert(
    { user_id: userId, ...parsed.data },
    { onConflict: "session_id,exercise_id,set_number" },
  );
  if (error) return { values, fieldErrors: {}, formError: SAVE_ERROR };

  revalidatePath(`/workout/${parsed.data.session_id}`);
  return { values, fieldErrors: {}, saved: true };
}

const deleteSchema = z.object({
  session_id: z.uuid(),
  exercise_id: z.uuid(),
  set_number: z.coerce.number().int().min(1).max(30),
});

export async function deleteSet(formData: FormData) {
  const parsed = deleteSchema.safeParse(formToValues(formData));
  if (!parsed.success) return;

  const { supabase } = await currentUser();
  const { data: session } = await supabase
    .from("workout_sessions")
    .select("finished_at")
    .eq("id", parsed.data.session_id)
    .maybeSingle();
  if (!session || session.finished_at) return;

  await supabase
    .from("workout_sets")
    .delete()
    .eq("session_id", parsed.data.session_id)
    .eq("exercise_id", parsed.data.exercise_id)
    .eq("set_number", parsed.data.set_number);

  revalidatePath(`/workout/${parsed.data.session_id}`);
}

export async function finishWorkout(formData: FormData) {
  const sessionId = z.uuid().safeParse(formData.get("session_id"));
  if (!sessionId.success) return;

  const { supabase } = await currentUser();
  const { count } = await supabase
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId.data);

  if (!count) {
    // Nothing was logged: drop the empty session instead of keeping a ghost.
    await supabase.from("workout_sessions").delete().eq("id", sessionId.data);
    redirect("/workout");
  }

  await supabase
    .from("workout_sessions")
    .update({ finished_at: new Date().toISOString() })
    .eq("id", sessionId.data)
    .is("finished_at", null);

  revalidatePath(`/workout/${sessionId.data}`);
  redirect(`/workout/${sessionId.data}`);
}

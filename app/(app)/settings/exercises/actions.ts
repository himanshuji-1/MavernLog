"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getUserId } from "@/lib/supabase/server";
import { formToValues, zodFieldErrors, type FormState } from "@/lib/validation/form";
import { exerciseSchema } from "@/lib/validation/workout";

async function currentUser() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");
  return { supabase, userId };
}

const UNIQUE_VIOLATION = "23505";

export async function saveExercise(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formToValues(formData);
  const parsed = exerciseSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: zodFieldErrors(parsed.error) };
  }

  const { supabase, userId } = await currentUser();
  const id = z.uuid().safeParse(values.id);

  const result = id.success
    ? await supabase.from("exercises").update(parsed.data).eq("id", id.data)
    : await insertExercise(supabase, userId, parsed.data);

  if (result.error) {
    return {
      values,
      fieldErrors: {},
      formError:
        result.error.code === UNIQUE_VIOLATION
          ? "You already have an exercise with that name."
          : "Couldn't save. Please try again.",
    };
  }

  revalidatePath("/settings/exercises");
  revalidatePath("/workout");
  return { values, fieldErrors: {}, saved: true };
}

async function insertExercise(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  data: z.infer<typeof exerciseSchema>,
) {
  const { data: last } = await supabase
    .from("exercises")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return supabase
    .from("exercises")
    .insert({ ...data, user_id: userId, sort_order: (last?.sort_order ?? -1) + 1 });
}

export async function setArchived(formData: FormData) {
  const values = formToValues(formData);
  const id = z.uuid().safeParse(values.id);
  if (!id.success) return;

  const { supabase } = await currentUser();
  await supabase.from("exercises").update({ archived: values.archived === "true" }).eq("id", id.data);

  revalidatePath("/settings/exercises");
  revalidatePath("/workout");
}
